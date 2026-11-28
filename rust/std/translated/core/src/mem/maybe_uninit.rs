use crate::any::type_name;
use crate::clone::TrivialClone;
use crate::marker::{Destruct, Freeze};
use crate::mem::{ManuallyDrop, transmute_neo};
use crate::{fmt, intrinsics, ptr, slice};

/// A wrapper type to construct uninitialized instances of `T`.
///
/// # 初始化不变式
///
/// 通常，编译器假设变量已处于 [正确初始化或“有效”] 状态，符合变量类型的需求。例如，一个引用类型的变量必须对齐且不为空。这是一个必须始终遵守的不变式。
/// 即使在 unsafe 代码中也是如此。因此，对引用类型变量进行零初始化会导致
/// 即时的未定义行为，无论该引用是否用于访问内存：
/// *always* be upheld, even in unsafe code. As a consequence, zero-initializing a
/// variable of reference type causes instantaneous undefined behavior,
/// no matter whether that reference ever gets used to access memory:
///
/// ```rust,no_run
/// # #![allow(invalid_value)]
/// use std::mem::{self, MaybeUninit};
///
/// let x: &i32 = unsafe { mem::zeroed() }; // undefined behavior! ⚠️
/// // The equivalent code with `MaybeUninit<&i32>`:
/// let x: &i32 = unsafe { MaybeUninit::zeroed().assume_init() }; // undefined behavior! ⚠️
/// ```
///
/// 此外，未初始化的内存具有特殊性，它没有固定值（“固定”意味着“不写入就不会改变”）。读取同一未初始化的字节
/// run-time checks and optimizing `enum` layout.
///
/// Similarly, entirely uninitialized memory may have any content, while a `bool` must
/// always be `true` or `false`. Hence, creating an uninitialized `bool` is undefined behavior:
///
/// ```rust,no_run
/// # #![allow(invalid_value)]
/// use std::mem::{self, MaybeUninit};
///
/// let b: bool = unsafe { mem::uninitialized() }; // undefined behavior! ⚠️
/// // The equivalent code with `MaybeUninit<bool>`:
/// let b: bool = unsafe { MaybeUninit::uninit().assume_init() }; // undefined behavior! ⚠️
/// ```
///
/// 参见下面的逐字段结构体初始化示例作为此类情况。
/// meaning "it won't change without being written to"). Reading the same uninitialized byte
/// multiple times can give different results. This makes it undefined behavior to have
/// *即时* 未定义行为，但在大多数安全操作（包括删除它）中会导致未定义行为。
/// # 示例
///
/// ```rust,no_run
/// # #![allow(invalid_value)]
/// use std::mem::{self, MaybeUninit};
///
/// let x: i32 = unsafe { mem::uninitialized() }; // undefined behavior! ⚠️
/// // The equivalent code with `MaybeUninit<i32>`:
/// let x: i32 = unsafe { MaybeUninit::uninit().assume_init() }; // undefined behavior! ⚠️
/// ```
///
/// Conversely, sometimes it is okay to not initialize *all* bytes of a `MaybeUninit`
/// before calling `assume_init`. For instance, padding bytes do not have to be initialized.
/// 被初始化：
///
/// 然后编译器知道不要对这段代码做出任何错误的假设或优化。
/// being considered initialized at the type level. For example, a `1`-initialized [`Vec<T>`]
/// is considered initialized (under the current implementation; this does not constitute
/// a stable guarantee) because the only requirement the compiler knows about it
/// is that the data pointer must be non-null. Creating such a `Vec<T>` does not cause
/// *immediate* undefined behavior, but will cause undefined behavior with most
/// safe operations (including dropping it).
///
/// [`Vec<T>`]: ../../std/vec/struct.Vec.html
///
/// # Examples
///
/// `MaybeUninit<T>` serves to enable unsafe code to deal with uninitialized data.
/// It is a signal to the compiler indicating that the data here might *not*
/// be initialized:
///
/// ```rust
/// use std::mem::MaybeUninit;
///
/// // Create an explicitly uninitialized reference. The compiler knows that data inside
/// // a `MaybeUninit<T>` may be invalid, and hence this is not UB:
/// let mut x = MaybeUninit::<&i32>::uninit();
/// // Set it to a valid value.
/// x.write(&0);
/// // Extract the initialized data -- this is only allowed *after* properly
/// // initializing `x`!
/// let x = unsafe { x.assume_init() };
/// ```
///
/// The compiler then knows to not make any incorrect assumptions or optimizations on this code.
///
/// You can think of `MaybeUninit<T>` as being a bit like `Option<T>` but without
/// 任何运行时跟踪机制以及所有安全检查。
///
/// ## 输出指针
///
/// You can use `MaybeUninit<T>` to implement "out-pointers": instead of returning data
/// ## 逐元素初始化数组
/// result into. This can be useful when it is important for the caller to control
/// 你也可以处理部分初始化的数组，这种用法常见于底层数据结构。
/// ## 逐字段初始化结构体
///
/// ```
/// use std::mem::MaybeUninit;
///
/// unsafe fn make_vec(out: *mut Vec<i32>) {
///     // `write` does not drop the old contents, which is important.
///     unsafe { out.write(vec![1, 2, 3]); }
/// }
///
/// let mut v = MaybeUninit::uninit();
/// unsafe { make_vec(v.as_mut_ptr()); }
/// // Now we know `v` is initialized! This also makes sure the vector gets
/// // properly dropped.
/// let v = unsafe { v.assume_init() };
/// assert_eq!(&v, &[1, 2, 3]);
/// ```
///
/// ## Initializing an array element-by-element
///
/// `MaybeUninit<T>` can be used to initialize a large array element-by-element:
///
/// ```
/// use std::mem::{self, MaybeUninit};
///
/// let data = {
///     // Create an uninitialized array of `MaybeUninit`.
///     let mut data: [MaybeUninit<Vec<u32>>; 1000] = [const { MaybeUninit::uninit() }; 1000];
///
///     // Dropping a `MaybeUninit` does nothing, so if there is a panic during this loop,
///     // we have a memory leak, but there is no memory safety issue.
///     for elem in &mut data[..] {
///         elem.write(vec![42]);
///     }
///
///     // Everything is initialized. Transmute the array to the
///     // initialized type.
///     unsafe { mem::transmute::<_, [Vec<u32>; 1000]>(data) }
/// };
///
/// assert_eq!(&data[0], &[42]);
/// ```
///
/// ## 布局
/// be found in low-level datastructures.
///
/// ```
/// use std::mem::MaybeUninit;
///
/// // Create an uninitialized array of `MaybeUninit`.
/// let mut data: [MaybeUninit<String>; 1000] = [const { MaybeUninit::uninit() }; 1000];
/// // Count the number of elements we have assigned.
/// let mut data_len: usize = 0;
///
/// for elem in &mut data[0..500] {
///     elem.write(String::from("hello"));
///     data_len += 1;
/// }
///
/// // For each item in the array, drop if we allocated it.
/// for elem in &mut data[0..data_len] {
///     unsafe { elem.assume_init_drop(); }
/// }
/// ```
///
/// ## Initializing a struct field-by-field
///
/// You can use `MaybeUninit<T>` and the [`&raw mut`] syntax to initialize structs field by field:
///
/// ```rust
/// use std::mem::MaybeUninit;
///
/// #[derive(Debug, PartialEq)]
/// pub struct Foo {
///     name: String,
///     list: Vec<u8>,
/// }
///
/// let foo = {
///     let mut uninit: MaybeUninit<Foo> = MaybeUninit::uninit();
///     let ptr = uninit.as_mut_ptr();
///
///     // Initializing the `name` field
///     // Using `write` instead of assignment via `=` to not call `drop` on the
///     // old, uninitialized value.
///     unsafe { (&raw mut (*ptr).name).write("Bob".to_string()); }
///
///     // Initializing the `list` field
///     // If there is a panic here, then the `String` in the `name` field leaks.
///     unsafe { (&raw mut (*ptr).list).write(vec![0, 1, 2]); }
///
///     // All the fields are initialized, so we call `assume_init` to get an initialized Foo.
///     unsafe { uninit.assume_init() }
/// };
///
/// assert_eq!(
///     foo,
///     Foo {
///         name: "Bob".to_string(),
///         list: vec![0, 1, 2]
///     }
/// );
/// ```
/// [`&raw mut`]: https://doc.rust-lang.org/reference/types/pointer.html#r-type.pointer.raw.constructor
/// [validity]: ../../reference/behavior-considered-undefined.html#r-undefined.validity
///
/// Note that we have not initialized the padding, but that's fine -- it does not have to be
/// initialized. In fact, even if we had initialized the padding in `uninit`, those bytes would be
/// lost when copying the result: no matter the contents of the padding bytes in `uninit`, they will
/// always be uninitialized in `foo`.
///
/// # Layout
///
/// `MaybeUninit<T>` is guaranteed to have the same size, alignment, and ABI as `T`:
///
/// ```rust
/// use std::mem::MaybeUninit;
/// assert_eq!(size_of::<MaybeUninit<u64>>(), size_of::<u64>());
/// assert_eq!(align_of::<MaybeUninit<u64>>(), align_of::<u64>());
/// ```
///
/// However remember that a type *containing* a `MaybeUninit<T>` is not necessarily the same
/// layout; Rust does not in general guarantee that the fields of a `Foo<T>` have the same order as
/// a `Foo<U>` even if `T` and `U` have the same size and alignment. Furthermore because any bit
/// value is valid for a `MaybeUninit<T>` the compiler can't apply non-zero/niche-filling
/// optimizations, potentially resulting in a larger size:
///
/// ```rust
/// # use std::mem::MaybeUninit;
/// assert_eq!(size_of::<Option<bool>>(), 1);
/// assert_eq!(size_of::<Option<MaybeUninit<bool>>>(), 2);
/// ```
///
/// If `T` is FFI-safe, then so is `MaybeUninit<T>`.
///
/// While `MaybeUninit` is `#[repr(transparent)]` (indicating it guarantees the same size,
/// alignment, and ABI as `T`), this does *not* change any of the previous caveats. `Option<T>` and
/// `Option<MaybeUninit<T>>` may still have different sizes, and types containing a field of type
/// `T` may be laid out (and sized) differently than if that field were `MaybeUninit<T>`.
/// `MaybeUninit` is a union type, and `#[repr(transparent)]` on unions is unstable (see [the
/// tracking issue](https://github.com/rust-lang/rust/issues/60405)). Over time, the exact
/// guarantees of `#[repr(transparent)]` on unions may evolve, and `MaybeUninit` may or may not
/// remain `#[repr(transparent)]`. That said, `MaybeUninit<T>` will *always* guarantee that it has
/// the same size, alignment, and ABI as `T`; it's just that the way `MaybeUninit` implements that
/// 保证可能会发生变化。
///
/// Note that even though `T` and `MaybeUninit<T>` are ABI compatible it is still unsound to
/// transmute `&mut T` to `&mut MaybeUninit<T>` and expose that to safe code because it would allow
/// 安全代码访问未初始化的内存：
///
/// ```rust,no_run
/// use core::mem::MaybeUninit;
///
/// fn unsound_transmute<T>(val: &mut T) -> &mut MaybeUninit<T> {
///     unsafe { core::mem::transmute(val) }
/// }
///
/// fn main() {
///     let mut code = 0;
///     let code = &mut code;
///     let code2 = unsound_transmute(code);
///     *code2 = MaybeUninit::uninit();
///     std::process::exit(*code); // UB! Accessing uninitialized memory.
/// }
/// ```
///
/// # 有效性
///
/// `MaybeUninit<T>` has no validity requirements – any sequence of [bytes] of
/// 表示方式。
/// representation.
///
/// Moving or copying a value of type `MaybeUninit<T>` (i.e., performing a
/// "typed copy") will exactly preserve the contents, including the
/// [provenance], of all non-padding bytes of type `T` in the value's
/// 表示方式中的字节。
///
/// Therefore `MaybeUninit` can be used to perform a round trip of a value from
/// type `T` to type `MaybeUninit<U>` then back to type `T`, while preserving
/// the original value, if two conditions are met. One, type `U` must have the
/// same size as type `T`. Two, for all byte offsets where type `U` has padding,
/// 该值表示方式中的对应字节必须是
/// 未初始化的。
///
/// For example, due to the fact that the type `[u8; size_of::<T>]` has no
/// padding, the following is sound for any type `T` and will return the
/// 注意：复制包含引用的值可能会隐式重新借用这些引用，
///
/// ```rust,no_run
/// # use core::mem::{MaybeUninit, transmute};
/// # struct T;
/// fn identity(t: T) -> T {
///     unsafe {
///         let u: MaybeUninit<[u8; size_of::<T>()]> = transmute(t);
///         transmute(u) // OK.
///     }
/// }
/// ```
///
/// 导致返回值的来源与原始值不同。这同样适用于简单的恒等函数：
/// 注意：移动或复制表示方式中有已初始化字节的
/// original. This applies equally to the trivial identity function:
///
/// ```rust,no_run
/// fn trivial_identity<T>(t: T) -> T { t }
/// ```
///
/// Note: Moving or copying a value whose representation has initialized bytes
/// at byte offsets where the type has padding may lose the value of those
/// 原始值的表示方式中有已初始化字节时，可能会
/// *representation* of that value as bytes may not be. Again, this applies
/// equally to `trivial_identity`.
///
/// Note: Performing this round trip when type `U` has padding at byte offsets
/// where the representation of the original value has initialized bytes may
/// produce undefined behavior or a different value. For example, the following
/// is unsound since `T` requires all bytes to be initialized:
///
/// ```rust,no_run
/// # use core::mem::{MaybeUninit, transmute};
/// #[repr(C)] struct T([u8; 4]);
/// #[repr(C)] struct U(u8, u16);
/// fn unsound_identity(t: T) -> T {
///     unsafe {
///         let u: MaybeUninit<U> = transmute(t);
///         transmute(u) // UB.
///     }
/// }
/// ```
///
/// Conversely, the following is sound since `T` allows uninitialized bytes in
/// the representation of a value, but the round trip may alter the value:
///
/// ```rust,no_run
/// # use core::mem::{MaybeUninit, transmute};
/// #[repr(C)] struct T(MaybeUninit<[u8; 4]>);
/// #[repr(C)] struct U(u8, u16);
/// fn non_identity(t: T) -> T {
///     unsafe {
///         // May lose an initialized byte.
///         let u: MaybeUninit<U> = transmute(t);
///         transmute(u)
///     }
/// }
/// ```
///
/// [bytes]: ../../reference/memory-model.html#bytes
/// [provenance]: crate::ptr#provenance
#[stable(feature = "maybe_uninit", since = "1.36.0")]
// Lang item so we can wrap other types in it. This is useful for coroutines.
#[lang = "maybe_uninit"]
#[derive(Copy)]
#[repr(transparent)]
#[rustc_pub_transparent]
pub union MaybeUninit<T> {
    uninit: (),
    value: ManuallyDrop<T>,
}

#[stable(feature = "maybe_uninit", since = "1.36.0")]
impl<T: Copy> Clone for MaybeUninit<T> {
    #[inline(always)]
    fn clone(&self) -> Self {
        // Not calling `T::clone()`, we cannot know if we are initialized enough for that.
        *self
    }
}

// SAFETY: the clone implementation is a copy, see above.
#[doc(hidden)]
#[unstable(feature = "trivial_clone", issue = "none")]
unsafe impl<T> TrivialClone for MaybeUninit<T> where MaybeUninit<T>: Clone {}

#[stable(feature = "maybe_uninit_debug", since = "1.41.0")]
impl<T> fmt::Debug for MaybeUninit<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // NB: there is no `.pad_fmt` so we can't use a simpler `format_args!("MaybeUninit<{..}>").
        let full_name = type_name::<Self>();
        let prefix_len = full_name.find("MaybeUninit").unwrap();
        f.pad(&full_name[prefix_len..])
    }
}

impl<T> MaybeUninit<T> {
    /// Creates a new `MaybeUninit<T>` initialized with the given value.
    /// It is safe to call [`assume_init`] on the return value of this function.
    ///
    /// Note that dropping a `MaybeUninit<T>` will never call `T`'s drop code.
    /// It is your responsibility to make sure `T` gets dropped if it got initialized.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::mem::MaybeUninit;
    ///
    /// let v: MaybeUninit<Vec<u8>> = MaybeUninit::new(vec![42]);
    /// # // Prevent leaks for Miri
    /// # unsafe { let _ = MaybeUninit::assume_init(v); }
    /// ```
    ///
    /// [`assume_init`]: MaybeUninit::assume_init
    #[stable(feature = "maybe_uninit", since = "1.36.0")]
    #[rustc_const_stable(feature = "const_maybe_uninit", since = "1.36.0")]
    #[must_use = "use `forget` to avoid running Drop code"]
    #[inline(always)]
    pub const fn new(val: T) -> MaybeUninit<T> {
        MaybeUninit { value: ManuallyDrop::new(val) }
    }

    /// Creates a new `MaybeUninit<T>` in an uninitialized state.
    ///
    /// Note that dropping a `MaybeUninit<T>` will never call `T`'s drop code.
    /// It is your responsibility to make sure `T` gets dropped if it got initialized.
    ///
    /// 请参考 [类型级别文档][MaybeUninit] 以获取一些示例。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::mem::MaybeUninit;
    ///
    /// let v: MaybeUninit<String> = MaybeUninit::uninit();
    /// ```
    #[stable(feature = "maybe_uninit", since = "1.36.0")]
    #[rustc_const_stable(feature = "const_maybe_uninit", since = "1.36.0")]
    #[must_use]
    #[inline(always)]
    #[rustc_diagnostic_item = "maybe_uninit_uninit"]
    pub const fn uninit() -> MaybeUninit<T> {
        MaybeUninit { uninit: () }
    }

    /// Creates a new `MaybeUninit<T>` in an uninitialized state, with the memory being
    /// filled with `0` bytes. It depends on `T` whether that already makes for
    /// proper initialization. For example, `MaybeUninit<usize>::zeroed()` is initialized,
    /// but `MaybeUninit<&'static i32>::zeroed()` is not because references must not
    /// 为 null。
    ///
    /// Note that if `T` has padding bytes, those bytes are *not* preserved when the
    /// `MaybeUninit<T>` value is returned from this function, so those bytes are not
    /// guaranteed to be zeroed.
    ///
    /// Note that dropping a `MaybeUninit<T>` will never call `T`'s drop code.
    /// It is your responsibility to make sure `T` gets dropped if it got initialized.
    ///
    /// # 此函数的正确使用方式：使用零值初始化结构体，其中结构体的所有
    ///
    /// 字段都可以将位模式 0 作为有效值存储。
    /// 这可以在 const 上下文中使用，例如用于指示静态数组的结束，
    ///
    /// ```rust
    /// use std::mem::MaybeUninit;
    ///
    /// let x = MaybeUninit::<(u8, bool)>::zeroed();
    /// let x = unsafe { x.assume_init() };
    /// assert_eq!(x, (0, false));
    /// ```
    ///
    /// 以进行插件注册。
    /// plugin registration.
    ///
    /// *Incorrect* usage of this function: calling `x.zeroed().assume_init()`
    /// when `0` is not a valid bit-pattern for the type:
    ///
    /// ```rust,no_run
    /// use std::mem::MaybeUninit;
    ///
    /// enum NotZero { One = 1, Two = 2 }
    ///
    /// let x = MaybeUninit::<(u8, NotZero)>::zeroed();
    /// let x = unsafe { x.assume_init() };
    /// // Inside a pair, we create a `NotZero` that does not have a valid discriminant.
    /// // This is undefined behavior. ⚠️
    /// ```
    #[inline]
    #[must_use]
    #[rustc_diagnostic_item = "maybe_uninit_zeroed"]
    #[stable(feature = "maybe_uninit", since = "1.36.0")]
    #[rustc_const_stable(feature = "const_maybe_uninit_zeroed", since = "1.75.0")]
    pub const fn zeroed() -> MaybeUninit<T> {
        let mut u = MaybeUninit::<T>::uninit();
        // SAFETY: `u.as_mut_ptr()` points to allocated memory.
        unsafe { u.as_mut_ptr().write_bytes(0u8, 1) };
        u
    }

    /// Sets the value of the `MaybeUninit<T>`.
    ///
    /// 这会覆盖之前的任何值，而不会丢弃它，因此请注意
    /// 不要两次使用此功能，除非您希望跳过析构函数的执行。
    /// For your convenience, this also returns a mutable reference to the
    /// (now safely initialized) contents of `self`.
    ///
    /// As the content is stored inside a `ManuallyDrop`, the destructor is not
    /// 被析构。接收此函数返回的可修改引用的代码需要注意这一点。Rust 的安全模型将泄漏视为安全行为，但它们通常仍是不理想的。尽管如此，可修改引用
    /// [`assume_init`], [`assume_init_drop`], or similar. Code that receives
    /// 会丢弃旧内容。
    /// mind. The safety model of Rust regards leaks as safe, but they are
    /// usually still undesirable. This being said, the mutable reference
    /// behaves like any other mutable reference would, so assigning a new value
    /// to it will drop the old content.
    ///
    /// [`assume_init`]: Self::assume_init
    /// [`assume_init_drop`]: Self::assume_init_drop
    ///
    /// # 示例
    ///
    /// 此方法的正确用法：
    ///
    /// ```rust
    /// use std::mem::MaybeUninit;
    ///
    /// let mut x = MaybeUninit::<Vec<u8>>::uninit();
    ///
    /// {
    ///     let hello = x.write((&b"Hello, world!").to_vec());
    ///     // Setting hello does not leak prior allocations, but drops them
    ///     *hello = (&b"Hello").to_vec();
    ///     hello[0] = 'h' as u8;
    /// }
    /// // x is initialized now:
    /// let s = unsafe { x.assume_init() };
    /// assert_eq!(b"hello", s.as_slice());
    /// ```
    ///
    /// 这种方法的使用会导致泄漏：
    ///
    /// ```rust
    /// use std::mem::MaybeUninit;
    ///
    /// let mut x = MaybeUninit::<String>::uninit();
    ///
    /// x.write("Hello".to_string());
    /// # // FIXME(https://github.com/rust-lang/miri/issues/3670):
    /// # // use -Zmiri-disable-leak-check instead of unleaking in tests meant to leak.
    /// # unsafe { MaybeUninit::assume_init_drop(&mut x); }
    /// // This leaks the contained string:
    /// x.write("hello".to_string());
    /// // x is initialized now:
    /// let s = unsafe { x.assume_init() };
    /// ```
    ///
    /// 在某些情况下，可以使用此方法来避免unsafe操作。下面的示例
    /// 展示了固定大小 arena 实现的一部分，该 arena 会提供
    /// 固定引用。
    /// With `write`, we can avoid the need to write through a raw pointer:
    ///
    /// ```rust
    /// use core::pin::Pin;
    /// use core::mem::MaybeUninit;
    ///
    /// struct PinArena<T> {
    ///     memory: Box<[MaybeUninit<T>]>,
    ///     len: usize,
    /// }
    ///
    /// impl <T> PinArena<T> {
    ///     pub fn capacity(&self) -> usize {
    ///         self.memory.len()
    ///     }
    ///     pub fn push(&mut self, val: T) -> Pin<&mut T> {
    ///         if self.len >= self.capacity() {
    ///             panic!("Attempted to push to a full pin arena!");
    ///         }
    ///         let ref_ = self.memory[self.len].write(val);
    ///         self.len += 1;
    ///         unsafe { Pin::new_unchecked(ref_) }
    ///     }
    /// }
    /// ```
    #[inline(always)]
    #[stable(feature = "maybe_uninit_write", since = "1.55.0")]
    #[rustc_const_stable(feature = "const_maybe_uninit_write", since = "1.85.0")]
    pub const fn write(&mut self, val: T) -> &mut T {
        *self = MaybeUninit::new(val);
        // SAFETY: We just initialized this value.
        unsafe { self.assume_init_mut() }
    }

    /// 获取指向包含值的指针。从此指针读取或将其
    /// into a reference is undefined behavior unless the `MaybeUninit<T>` is initialized.
    /// 对由该指针（非可传递）指向的内存进行写入是未定义行为
    /// (except inside an `UnsafeCell<T>`).
    ///
    /// # 示例
    ///
    /// 此方法的正确用法：
    ///
    /// ```rust
    /// use std::mem::MaybeUninit;
    ///
    /// let mut x = MaybeUninit::<Vec<u32>>::uninit();
    /// x.write(vec![0, 1, 2]);
    /// // Create a reference into the `MaybeUninit<T>`. This is okay because we initialized it.
    /// let x_vec = unsafe { &*x.as_ptr() };
    /// assert_eq!(x_vec.len(), 3);
    /// # // Prevent leaks for Miri
    /// # unsafe { MaybeUninit::assume_init_drop(&mut x); }
    /// ```
    ///
    /// *错误* 使用此方法：
    ///
    /// ```rust,no_run
    /// use std::mem::MaybeUninit;
    ///
    /// let x = MaybeUninit::<Vec<u32>>::uninit();
    /// let x_vec = unsafe { &*x.as_ptr() };
    /// // We have created a reference to an uninitialized vector! This is undefined behavior. ⚠️
    /// ```
    ///
    /// （注意，对未初始化数据的引用规则尚未确定，但在
    /// 确定之前，建议避免使用它们。）
    #[stable(feature = "maybe_uninit", since = "1.36.0")]
    #[rustc_const_stable(feature = "const_maybe_uninit_as_ptr", since = "1.59.0")]
    #[lint::as_ptr]
    #[inline(always)]
    pub const fn as_ptr(&self) -> *const T {
        // `MaybeUninit` and `ManuallyDrop` are both `repr(transparent)` so we can cast the pointer.
        self as *const _ as *const T
    }

    /// 获取指向包含值的可修改指针。从此指针读取或将其
    /// into a reference is undefined behavior unless the `MaybeUninit<T>` is initialized.
    ///
    /// # 示例
    ///
    /// 此方法的正确用法：
    ///
    /// ```rust
    /// use std::mem::MaybeUninit;
    ///
    /// let mut x = MaybeUninit::<Vec<u32>>::uninit();
    /// x.write(vec![0, 1, 2]);
    /// // Create a reference into the `MaybeUninit<Vec<u32>>`.
    /// // This is okay because we initialized it.
    /// let x_vec = unsafe { &mut *x.as_mut_ptr() };
    /// x_vec.push(3);
    /// assert_eq!(x_vec.len(), 4);
    /// # // Prevent leaks for Miri
    /// # unsafe { MaybeUninit::assume_init_drop(&mut x); }
    /// ```
    ///
    /// *错误* 使用此方法：
    ///
    /// ```rust,no_run
    /// use std::mem::MaybeUninit;
    ///
    /// let mut x = MaybeUninit::<Vec<u32>>::uninit();
    /// let x_vec = unsafe { &mut *x.as_mut_ptr() };
    /// // We have created a reference to an uninitialized vector! This is undefined behavior. ⚠️
    /// ```
    ///
    /// （注意，对未初始化数据的引用规则尚未确定，但在
    /// 确定之前，建议避免使用它们。）
    #[stable(feature = "maybe_uninit", since = "1.36.0")]
    #[rustc_const_stable(feature = "const_maybe_uninit_as_mut_ptr", since = "1.83.0")]
    #[lint::as_ptr]
    #[inline(always)]
    pub const fn as_mut_ptr(&mut self) -> *mut T {
        // `MaybeUninit` and `ManuallyDrop` are both `repr(transparent)` so we can cast the pointer.
        self as *mut _ as *mut T
    }

    /// Extracts the value from the `MaybeUninit<T>` container. This is a great way
    /// to ensure that the data will get dropped, because the resulting `T` is
    /// # 安全性
    ///
    /// # Safety
    ///
    /// It is up to the caller to guarantee that the `MaybeUninit<T>` really is in an initialized
    /// state, i.e., a state that is considered ["valid" for type `T`][validity]. Calling this when
    /// 不变式。
    /// 这是一个常见错误，人们认为对整数调用此函数很安全，因为它们可以
    /// 容纳所有位模式。另一个常见错误是认为如果任何字节未初始化就调用此函数
    ///
    /// 会导致未定义行为。这两种假设都是错误的。如果这让你感到惊讶，请阅读 [type-level documentation][inv]。
    /// can hold all bit patterns. It is also a common mistake to think that calling this function
    /// 在当前实现下被视为已初始化（这并不构成
    /// surprising to you, please read the [type-level documentation][inv].
    ///
    /// [inv]: #initialization-invariant
    /// [validity]: ../../reference/behavior-considered-undefined.html#r-undefined.validity
    ///
    /// On top of that, remember that most types have additional invariants beyond merely
    /// being considered initialized at the type level. For example, a `1`-initialized [`Vec<T>`]
    /// is considered initialized (under the current implementation; this does not constitute
    /// 因为编译器仅知道一个要求，所以这是一个稳定的保证。
    /// is that the data pointer must be non-null. Creating such a `Vec<T>` does not cause
    /// *立即*的未定义行为，但在大多数
    /// 安全操作（包括丢弃它）中会导致未定义行为。
    ///
    /// [`Vec<T>`]: ../../std/vec/struct.Vec.html
    ///
    /// # 示例
    ///
    /// 此方法的正确使用方式：
    ///
    /// ```rust
    /// use std::mem::MaybeUninit;
    ///
    /// let mut x = MaybeUninit::<bool>::uninit();
    /// x.write(true);
    /// let x_init = unsafe { x.assume_init() };
    /// assert_eq!(x_init, true);
    /// ```
    ///
    /// 此方法的*错误*使用方式：
    ///
    /// ```rust,no_run
    /// # #![allow(invalid_value)]
    /// use std::mem::MaybeUninit;
    ///
    /// let x: i32 = unsafe { MaybeUninit::uninit().assume_init() }; // undefined behavior! ⚠️
    /// ```
    ///
    /// 更多示例请参阅 [类型级别文档][#examples]。
    #[stable(feature = "maybe_uninit", since = "1.36.0")]
    #[rustc_const_stable(feature = "const_maybe_uninit_assume_init_by_value", since = "1.59.0")]
    #[inline(always)]
    #[rustc_diagnostic_item = "assume_init"]
    #[track_caller]
    pub const unsafe fn assume_init(self) -> T {
        // SAFETY: the caller must guarantee that `self` is initialized.
        // This also means that `self` must be a `value` variant.
        unsafe {
            intrinsics::assert_inhabited::<T>();
            // We do this via a transmute instead of `ManuallyDrop::into_inner` so that there's
            // no trace of `ManuallyDrop` in Miri's error messages here.
            transmute_neo(self)
        }
    }

    /// Reads the value from the `MaybeUninit<T>` container. The resulting `T` is subject
    /// 常规的丢弃处理影响。
    ///
    /// Whenever possible, it is preferable to use [`assume_init`] instead, which
    /// prevents duplicating the content of the `MaybeUninit<T>`.
    ///
    /// # 安全性
    ///
    /// It is up to the caller to guarantee that the `MaybeUninit<T>` really is in an initialized
    /// [类型级别文档][inv] 包含更多关于
    /// 此初始化不变量的信息。
    /// this initialization invariant.
    ///
    /// Moreover, similar to the [`ptr::read`] function, this function creates a
    /// bitwise copy of the contents, regardless whether the contained type
    /// implements the [`Copy`] trait or not. When using multiple copies of the
    /// data (by calling `assume_init_read` multiple times, or first calling
    /// `assume_init_read` and then [`assume_init`]), it is your responsibility
    /// *错误*的使用方式：
    ///
    /// [inv]: #initialization-invariant
    /// [`assume_init`]: MaybeUninit::assume_init
    ///
    /// # 将包含的值就地丢弃。
    ///
    /// Correct usage of this method:
    ///
    /// ```rust
    /// use std::mem::MaybeUninit;
    ///
    /// let mut x = MaybeUninit::<u32>::uninit();
    /// x.write(13);
    /// let x1 = unsafe { x.assume_init_read() };
    /// // `u32` is `Copy`, so we may read multiple times.
    /// let x2 = unsafe { x.assume_init_read() };
    /// assert_eq!(x1, x2);
    ///
    /// let mut x = MaybeUninit::<Option<Vec<u32>>>::uninit();
    /// x.write(None);
    /// let x1 = unsafe { x.assume_init_read() };
    /// // Duplicating a `None` value is okay, so we may read multiple times.
    /// let x2 = unsafe { x.assume_init_read() };
    /// assert_eq!(x1, x2);
    /// ```
    ///
    /// *Incorrect* usage of this method:
    ///
    /// ```rust,no_run
    /// use std::mem::MaybeUninit;
    ///
    /// let mut x = MaybeUninit::<Option<Vec<u32>>>::uninit();
    /// x.write(Some(vec![0, 1, 2]));
    /// let x1 = unsafe { x.assume_init_read() };
    /// let x2 = unsafe { x.assume_init_read() };
    /// // We now created two copies of the same vector, leading to a double-free ⚠️ when
    /// // they both get dropped!
    /// ```
    #[stable(feature = "maybe_uninit_extra", since = "1.60.0")]
    #[rustc_const_stable(feature = "const_maybe_uninit_assume_init_read", since = "1.75.0")]
    #[inline(always)]
    #[track_caller]
    pub const unsafe fn assume_init_read(&self) -> T {
        // SAFETY: the caller must guarantee that `self` is initialized.
        // Reading from `self.as_ptr()` is safe since `self` should be initialized.
        unsafe {
            intrinsics::assert_inhabited::<T>();
            self.as_ptr().read()
        }
    }

    /// # 安全性
    ///
    /// If you have ownership of the `MaybeUninit`, you can also use
    /// [`assume_init`] as an alternative.
    ///
    /// # 安全性
    ///
    /// It is up to the caller to guarantee that the `MaybeUninit<T>` really is
    /// 初始化时调用此函数会导致未定义行为。
    /// initialized causes undefined behavior.
    ///
    /// On top of that, all additional invariants of the type `T` must be
    /// satisfied, as the `Drop` implementation of `T` (or its members) may
    /// rely on this. For example, setting a `Vec<T>` to an invalid but
    /// 获取包含值的共享引用。
    /// this does not constitute a stable guarantee), because the only
    /// requirement the compiler knows about it is that the data pointer must be
    /// non-null. Dropping such a `Vec<T>` however will cause undefined
    /// behavior.
    ///
    /// [`assume_init`]: MaybeUninit::assume_init
    #[stable(feature = "maybe_uninit_extra", since = "1.60.0")]
    #[rustc_const_unstable(feature = "const_drop_in_place", issue = "109342")]
    pub const unsafe fn assume_init_drop(&mut self)
    where
        T: [const] Destruct,
    {
        // SAFETY: the caller must guarantee that `self` is initialized and
        // satisfies all invariants of `T`.
        // Dropping the value in place is safe if that is the case.
        unsafe { ptr::drop_in_place(self.as_mut_ptr()) }
    }

    /// Gets a shared reference to the contained value.
    ///
    /// This can be useful when we want to access a `MaybeUninit` that has been
    /// initialized but don't have ownership of the `MaybeUninit` (preventing the use
    /// of `.assume_init()`).
    ///
    /// # 安全性
    ///
    /// 在内容尚未完全初始化时调用此函数会导致未定义行为
    /// behavior: it is up to the caller to guarantee that the `MaybeUninit<T>` really
    /// 处于初始化状态。
    ///
    /// # 示例
    ///
    /// ### 正确使用此方法：
    ///
    /// ```rust
    /// use std::mem::MaybeUninit;
    ///
    /// let mut x = MaybeUninit::<Vec<u32>>::uninit();
    /// # let mut x_mu = x;
    /// # let mut x = &mut x_mu;
    /// // Initialize `x`:
    /// x.write(vec![1, 2, 3]);
    /// // Now that our `MaybeUninit<_>` is known to be initialized, it is okay to
    /// // create a shared reference to it:
    /// let x: &Vec<u32> = unsafe {
    ///     // SAFETY: `x` has been initialized.
    ///     x.assume_init_ref()
    /// };
    /// assert_eq!(x, &vec![1, 2, 3]);
    /// # // Prevent leaks for Miri
    /// # unsafe { MaybeUninit::assume_init_drop(&mut x_mu); }
    /// ```
    ///
    /// ### *错误* 使用此方法：
    ///
    /// ```rust,no_run
    /// use std::mem::MaybeUninit;
    ///
    /// let x = MaybeUninit::<Vec<u32>>::uninit();
    /// let x_vec: &Vec<u32> = unsafe { x.assume_init_ref() };
    /// // We have created a reference to an uninitialized vector! This is undefined behavior. ⚠️
    /// ```
    ///
    /// ```rust,no_run
    /// use std::{cell::Cell, mem::MaybeUninit};
    ///
    /// let b = MaybeUninit::<Cell<bool>>::uninit();
    /// // Initialize the `MaybeUninit` using `Cell::set`:
    /// unsafe {
    ///     b.assume_init_ref().set(true);
    ///     //^^^^^^^^^^^^^^^ Reference to an uninitialized `Cell<bool>`: UB!
    /// }
    /// ```
    #[stable(feature = "maybe_uninit_ref", since = "1.55.0")]
    #[rustc_const_stable(feature = "const_maybe_uninit_assume_init_ref", since = "1.59.0")]
    #[inline(always)]
    pub const unsafe fn assume_init_ref(&self) -> &T {
        // SAFETY: the caller must guarantee that `self` is initialized.
        // This also means that `self` must be a `value` variant.
        unsafe {
            intrinsics::assert_inhabited::<T>();
            &*self.as_ptr()
        }
    }

    /// 获取对包含值的可修改（唯一）引用。
    ///
    /// This can be useful when we want to access a `MaybeUninit` that has been
    /// initialized but don't have ownership of the `MaybeUninit` (preventing the use
    /// of `.assume_init()`).
    ///
    /// # 安全性
    ///
    /// 在内容尚未完全初始化时调用此函数会导致未定义行为
    /// behavior: it is up to the caller to guarantee that the `MaybeUninit<T>` really
    /// is in an initialized state. For instance, `.assume_init_mut()` cannot be used to
    /// initialize a `MaybeUninit`.
    ///
    /// # 示例
    ///
    /// ### 正确使用此方法：
    ///
    /// ```rust
    /// # #![allow(unexpected_cfgs)]
    /// use std::mem::MaybeUninit;
    ///
    /// # unsafe extern "C" fn initialize_buffer(buf: *mut [u8; 1024]) { unsafe { *buf = [0; 1024] } }
    /// # #[cfg(FALSE)]
    /// extern "C" {
    ///     /// Initializes *all* the bytes of the input buffer.
    ///     fn initialize_buffer(buf: *mut [u8; 1024]);
    /// }
    ///
    /// let mut buf = MaybeUninit::<[u8; 1024]>::uninit();
    ///
    /// // Initialize `buf`:
    /// unsafe { initialize_buffer(buf.as_mut_ptr()); }
    /// // Now we know that `buf` has been initialized, so we could `.assume_init()` it.
    /// // However, using `.assume_init()` may trigger a `memcpy` of the 1024 bytes.
    /// // To assert our buffer has been initialized without copying it, we upgrade
    /// // the `&mut MaybeUninit<[u8; 1024]>` to a `&mut [u8; 1024]`:
    /// let buf: &mut [u8; 1024] = unsafe {
    ///     // SAFETY: `buf` has been initialized.
    ///     buf.assume_init_mut()
    /// };
    ///
    /// // Now we can use `buf` as a normal slice:
    /// buf.sort_unstable();
    /// assert!(
    ///     buf.windows(2).all(|pair| pair[0] <= pair[1]),
    ///     "buffer is sorted",
    /// );
    /// ```
    ///
    /// ### *错误* 使用此方法：
    ///
    /// You cannot use `.assume_init_mut()` to initialize a value:
    ///
    /// ```rust,no_run
    /// use std::mem::MaybeUninit;
    ///
    /// let mut b = MaybeUninit::<bool>::uninit();
    /// unsafe {
    ///     *b.assume_init_mut() = true;
    ///     // We have created a (mutable) reference to an uninitialized `bool`!
    ///     // This is undefined behavior. ⚠️
    /// }
    /// ```
    ///
    /// For instance, you cannot [`Read`] into an uninitialized buffer:
    ///
    /// [`Read`]: ../../std/io/trait.Read.html
    ///
    /// ```rust,no_run
    /// use std::{io, mem::MaybeUninit};
    ///
    /// fn read_chunk (reader: &'_ mut dyn io::Read) -> io::Result<[u8; 64]>
    /// {
    ///     let mut buffer = MaybeUninit::<[u8; 64]>::uninit();
    ///     reader.read_exact(unsafe { buffer.assume_init_mut() })?;
    ///     //                         ^^^^^^^^^^^^^^^^^^^^^^^^
    ///     // (mutable) reference to uninitialized memory!
    ///     // This is undefined behavior.
    ///     Ok(unsafe { buffer.assume_init() })
    /// }
    /// ```
    ///
    /// 也不能通过直接字段访问进行逐字段逐步初始化：
    ///
    /// ```rust,no_run
    /// use std::{mem::MaybeUninit, ptr};
    ///
    /// struct Foo {
    ///     a: u32,
    ///     b: u8,
    /// }
    ///
    /// let foo: Foo = unsafe {
    ///     let mut foo = MaybeUninit::<Foo>::uninit();
    ///     ptr::write(&mut foo.assume_init_mut().a as *mut u32, 1337);
    ///     //              ^^^^^^^^^^^^^^^^^^^^^
    ///     // (mutable) reference to uninitialized memory!
    ///     // This is undefined behavior.
    ///     ptr::write(&mut foo.assume_init_mut().b as *mut u8, 42);
    ///     //              ^^^^^^^^^^^^^^^^^^^^^
    ///     // (mutable) reference to uninitialized memory!
    ///     // This is undefined behavior.
    ///     foo.assume_init()
    /// };
    /// ```
    #[stable(feature = "maybe_uninit_ref", since = "1.55.0")]
    #[rustc_const_stable(feature = "const_maybe_uninit_assume_init", since = "1.84.0")]
    #[inline(always)]
    pub const unsafe fn assume_init_mut(&mut self) -> &mut T {
        // SAFETY: the caller must guarantee that `self` is initialized.
        // This also means that `self` must be a `value` variant.
        unsafe {
            intrinsics::assert_inhabited::<T>();
            &mut *self.as_mut_ptr()
        }
    }

    /// Extracts the values from an array of `MaybeUninit` containers.
    ///
    /// # 安全性
    ///
    /// 由调用者确保数组中的所有元素都处于初始化状态。
    /// 处于初始化状态。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(maybe_uninit_array_assume_init)]
    /// use std::mem::MaybeUninit;
    ///
    /// let mut array: [MaybeUninit<i32>; 3] = [MaybeUninit::uninit(); 3];
    /// array[0].write(0);
    /// array[1].write(1);
    /// array[2].write(2);
    ///
    /// // SAFETY: Now safe as we initialised all elements
    /// let array = unsafe {
    ///     MaybeUninit::array_assume_init(array)
    /// };
    ///
    /// assert_eq!(array, [0, 1, 2]);
    /// ```
    #[unstable(feature = "maybe_uninit_array_assume_init", issue = "96097")]
    #[inline(always)]
    #[track_caller]
    pub const unsafe fn array_assume_init<const N: usize>(array: [Self; N]) -> [T; N] {
        // SAFETY:
        // * The caller guarantees that all elements of the array are initialized
        // * `MaybeUninit<T>` and T are guaranteed to have the same layout
        // * `MaybeUninit` does not drop, so there are no double-frees
        // And thus the conversion is safe
        unsafe {
            intrinsics::assert_inhabited::<[T; N]>();
            intrinsics::transmute_unchecked(array)
        }
    }

    /// Returns the contents of this `MaybeUninit` as a slice of potentially uninitialized bytes.
    ///
    /// Note that even if the contents of a `MaybeUninit` have been initialized, the value may still
    /// 包含未初始化的填充字节。
    ///
    /// This method requires `T: Freeze`. It's not available for types with interior mutability,
    /// such as `Cell<T>`.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(maybe_uninit_as_bytes)]
    /// use std::mem::MaybeUninit;
    ///
    /// let val = 0x12345678_i32;
    /// let uninit = MaybeUninit::new(val);
    /// let uninit_bytes = uninit.as_bytes();
    /// let bytes = unsafe { uninit_bytes.assume_init_ref() };
    /// assert_eq!(bytes, val.to_ne_bytes());
    /// ```
    #[unstable(feature = "maybe_uninit_as_bytes", issue = "93092")]
    pub const fn as_bytes(&self) -> &[MaybeUninit<u8>]
    where
        T: Freeze,
    {
        // SAFETY: MaybeUninit<u8> is always valid, even for padding bytes
        unsafe {
            slice::from_raw_parts(self.as_ptr().cast::<MaybeUninit<u8>>(), super::size_of::<T>())
        }
    }

    /// Returns the contents of this `MaybeUninit` as a mutable slice of potentially uninitialized
    /// 字节的可修改切片。
    ///
    /// Note that even if the contents of a `MaybeUninit` have been initialized, the value may still
    /// 包含未初始化的填充字节。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(maybe_uninit_as_bytes)]
    /// use std::mem::MaybeUninit;
    ///
    /// let val = 0x12345678_i32;
    /// let mut uninit = MaybeUninit::new(val);
    /// let uninit_bytes = uninit.as_bytes_mut();
    /// if cfg!(target_endian = "little") {
    ///     uninit_bytes[0].write(0xcd);
    /// } else {
    ///     uninit_bytes[3].write(0xcd);
    /// }
    /// let val2 = unsafe { uninit.assume_init() };
    /// assert_eq!(val2, 0x123456cd);
    /// ```
    #[unstable(feature = "maybe_uninit_as_bytes", issue = "93092")]
    pub const fn as_bytes_mut(&mut self) -> &mut [MaybeUninit<u8>] {
        // SAFETY: MaybeUninit<u8> is always valid, even for padding bytes
        unsafe {
            slice::from_raw_parts_mut(
                self.as_mut_ptr().cast::<MaybeUninit<u8>>(),
                super::size_of::<T>(),
            )
        }
    }

    /// Converts `&T` to `&MaybeUninit<T>`.
    ///
    /// 值保持初始化状态。此函数仅改变引用的类型。
    ///
    /// There is no corresponding `from_mut` method, because it could allow writing uninitialized memory
    /// 到原始值中。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(maybe_uninit_from_ref, maybe_uninit_as_bytes)]
    /// use std::mem::MaybeUninit;
    ///
    /// let val = 0x12345678_u32;
    /// let uninit = MaybeUninit::from_ref(&val);
    /// let bytes = uninit.as_bytes();
    ///
    /// // All bytes of a u32 are initialized, so assume_init is sound here:
    /// let byte_val = unsafe { bytes[0].assume_init() };
    /// assert_eq!(byte_val, val.to_ne_bytes()[0]);
    /// ```
    #[unstable(feature = "maybe_uninit_from_ref", issue = "165213")]
    #[inline]
    #[must_use]
    pub const fn from_ref(r: &T) -> &MaybeUninit<T> {
        // SAFETY: `MaybeUninit<T>` is repr(transparent) and every initialized T is a valid MaybeUninit<T>
        unsafe { &*ptr::from_ref(r).cast() }
    }
}

impl<T> [MaybeUninit<T>] {
    /// Copies the elements from `src` to `self`,
    /// returning a mutable reference to the now initialized contents of `self`.
    ///
    /// If `T` does not implement `Copy`, use [`write_clone_of_slice`] instead.
    ///
    /// This is similar to [`slice::copy_from_slice`].
    ///
    /// # Panics
    ///
    /// 如果两个切片长度不同，此函数会触发 panic。
    ///
    /// # Examples
    ///
    /// ```
    /// use std::mem::MaybeUninit;
    ///
    /// let mut dst = [MaybeUninit::uninit(); 32];
    /// let src = [0; 32];
    ///
    /// let init = dst.write_copy_of_slice(&src);
    ///
    /// assert_eq!(init, src);
    /// ```
    ///
    /// ```
    /// let mut vec = Vec::with_capacity(32);
    /// let src = [0; 16];
    ///
    /// vec.spare_capacity_mut()[..src.len()].write_copy_of_slice(&src);
    ///
    /// // SAFETY: we have just copied all the elements of len into the spare capacity
    /// // the first src.len() elements of the vec are valid now.
    /// unsafe {
    ///     vec.set_len(src.len());
    /// }
    ///
    /// assert_eq!(vec, src);
    /// ```
    ///
    /// [`write_clone_of_slice`]: slice::write_clone_of_slice
    #[stable(feature = "maybe_uninit_write_slice", since = "1.93.0")]
    #[rustc_const_stable(feature = "maybe_uninit_write_slice", since = "1.93.0")]
    pub const fn write_copy_of_slice(&mut self, src: &[T]) -> &mut [T]
    where
        T: Copy,
    {
        // SAFETY: &[T] and &[MaybeUninit<T>] have the same layout
        let uninit_src: &[MaybeUninit<T>] = unsafe { super::transmute(src) };

        self.copy_from_slice(uninit_src);

        // SAFETY: Valid elements have just been copied into `self` so it is initialized
        unsafe { self.assume_init_mut() }
    }

    /// Clones the elements from `src` to `self`,
    /// returning a mutable reference to the now initialized contents of `self`.
    /// 任何已初始化的元素均不会被丢弃。
    ///
    /// If `T` implements `Copy`, use [`write_copy_of_slice`] instead.
    ///
    /// This is similar to [`slice::clone_from_slice`] but does not drop existing elements.
    ///
    /// # Panics
    ///
    /// This function will panic if the two slices have different lengths, or if the implementation of `Clone` panics.
    ///
    /// 如果发生 panic，已克隆的元素将被丢弃。
    ///
    /// # Examples
    ///
    /// ```
    /// use std::mem::MaybeUninit;
    ///
    /// let mut dst = [const { MaybeUninit::uninit() }; 5];
    /// let src = ["wibbly", "wobbly", "timey", "wimey", "stuff"].map(|s| s.to_string());
    ///
    /// let init = dst.write_clone_of_slice(&src);
    ///
    /// assert_eq!(init, src);
    ///
    /// # // Prevent leaks for Miri
    /// # unsafe { std::ptr::drop_in_place(init); }
    /// ```
    ///
    /// ```
    /// let mut vec = Vec::with_capacity(32);
    /// let src = ["rust", "is", "a", "pretty", "cool", "language"].map(|s| s.to_string());
    ///
    /// vec.spare_capacity_mut()[..src.len()].write_clone_of_slice(&src);
    ///
    /// // SAFETY: we have just cloned all the elements of len into the spare capacity
    /// // the first src.len() elements of the vec are valid now.
    /// unsafe {
    ///     vec.set_len(src.len());
    /// }
    ///
    /// assert_eq!(vec, src);
    /// ```
    ///
    /// [`write_copy_of_slice`]: slice::write_copy_of_slice
    #[stable(feature = "maybe_uninit_write_slice", since = "1.93.0")]
    pub fn write_clone_of_slice(&mut self, src: &[T]) -> &mut [T]
    where
        T: Clone,
    {
        // unlike copy_from_slice this does not call clone_from_slice on the slice
        // this is because `MaybeUninit<T: Clone>` does not implement Clone.

        assert_eq!(self.len(), src.len(), "destination and source slices have different lengths");

        // NOTE: We need to explicitly slice them to the same length
        // for bounds checking to be elided, and the optimizer will
        // generate memcpy for simple cases (for example T = u8).
        let len = self.len();
        let src = &src[..len];

        // guard is needed b/c panic might happen during a clone
        let mut guard = Guard { slice: self, initialized: 0 };

        for i in 0..len {
            guard.slice[i].write(src[i].clone());
            guard.initialized += 1;
        }

        super::forget(guard);

        // SAFETY: Valid elements have just been written into `self` so it is initialized
        unsafe { self.assume_init_mut() }
    }

    /// Fills a slice with elements by cloning `value`, returning a mutable reference to the now
    /// 初始化的内容的可修改引用。
    /// 任何之前初始化的元素均不会被丢弃。
    ///
    /// This is similar to [`slice::fill`].
    ///
    /// # Panics
    ///
    /// This function will panic if any call to `Clone` panics.
    ///
    /// 如果发生此类 panic，此操作期间之前初始化的任何元素将被
    /// 丢弃。
    ///
    /// # Examples
    ///
    /// ```
    /// #![feature(maybe_uninit_fill)]
    /// use std::mem::MaybeUninit;
    ///
    /// let mut buf = [const { MaybeUninit::uninit() }; 10];
    /// let initialized = buf.write_filled(1);
    /// assert_eq!(initialized, &mut [1; 10]);
    /// ```
    #[doc(alias = "memset")]
    #[unstable(feature = "maybe_uninit_fill", issue = "117428")]
    pub fn write_filled(&mut self, value: T) -> &mut [T]
    where
        T: Clone,
    {
        SpecFill::spec_fill(self, value);
        // SAFETY: Valid elements have just been filled into `self` so it is initialized
        unsafe { self.assume_init_mut() }
    }

    /// 通过为每个索引调用闭包来填充切片并返回的元素。
    ///
    /// This method uses a closure to create new values. If you'd rather `Clone` a given value, use
    /// [`slice::write_filled`]. If you want to use the `Default` trait to generate values, use
    /// [`slice::write_default`].
    ///
    /// # Panics
    ///
    /// 如果提供的闭包的任何调用触发 panic，此函数会触发 panic。
    ///
    /// 如果发生此类 panic，此操作期间之前初始化的任何元素将被
    /// 丢弃。
    ///
    /// # Examples
    ///
    /// ```
    /// #![feature(maybe_uninit_fill)]
    /// use std::mem::MaybeUninit;
    ///
    /// let mut buf = [const { MaybeUninit::<usize>::uninit() }; 5];
    /// let initialized = buf.write_with(|idx| idx + 1);
    /// assert_eq!(initialized, &mut [1, 2, 3, 4, 5]);
    /// ```
    #[unstable(feature = "maybe_uninit_fill", issue = "117428")]
    pub fn write_with<F>(&mut self, mut f: F) -> &mut [T]
    where
        F: FnMut(usize) -> T,
    {
        let mut guard = Guard { slice: self, initialized: 0 };

        for (idx, element) in guard.slice.iter_mut().enumerate() {
            element.write(f(idx));
            guard.initialized += 1;
        }

        super::forget(guard);

        // SAFETY: Valid elements have just been written into `this` so it is initialized
        unsafe { self.assume_init_mut() }
    }

    /// Fills a slice with elements returned by calling [`Default::default`] for each index.
    ///
    /// # Panics
    ///
    /// This function will panic if any call to [`Default::default`] panics.
    ///
    /// 如果发生此类 panic，此操作期间之前初始化的任何元素将被
    /// 丢弃。
    ///
    /// # Examples
    ///
    /// ```
    /// #![feature(maybe_uninit_fill)]
    /// use std::mem::MaybeUninit;
    ///
    /// let mut buf = [const { MaybeUninit::<usize>::uninit() }; 5];
    /// let initialized = buf.write_default();
    /// assert_eq!(initialized, &mut [0, 0, 0, 0, 0]);
    /// ```
    #[unstable(feature = "maybe_uninit_fill", issue = "117428")]
    pub fn write_default(&mut self) -> &mut [T]
    where
        T: Default,
    {
        trait DefaultSpec: Default {
            fn write_default(buf: &mut [MaybeUninit<Self>]) -> &mut [Self];
        }

        impl<T: Default> DefaultSpec for T {
            default fn write_default(buf: &mut [MaybeUninit<Self>]) -> &mut [Self] {
                buf.write_with(|_| T::default())
            }
        }

        macro_rules! spec_default_zero {
            ($ty:ty) => {
                impl DefaultSpec for $ty {
                    fn write_default(buf: &mut [MaybeUninit<Self>]) -> &mut [Self] {
                        // SAFETY:
                        // `Default::default` is equivalent to zero-initialization
                        // for all these types, and this initializes the entire
                        // slice.
                        unsafe {
                            buf.as_mut_ptr().write_bytes(0, buf.len());
                            buf.assume_init_mut()
                        }
                    }
                }
            };
        }

        spec_default_zero!(bool); // The default is `false == 0`.
        spec_default_zero!(char);
        spec_default_zero!(i8);
        spec_default_zero!(u8);
        spec_default_zero!(i16);
        spec_default_zero!(u16);
        spec_default_zero!(i32);
        spec_default_zero!(u32);
        spec_default_zero!(i64);
        spec_default_zero!(u64);
        spec_default_zero!(i128);
        spec_default_zero!(u128);
        spec_default_zero!(isize);
        spec_default_zero!(usize);
        // +0.0 has binary representation of all-zeros:
        spec_default_zero!(f16);
        spec_default_zero!(f32);
        spec_default_zero!(f64);
        spec_default_zero!(f128);

        T::write_default(self)
    }

    /// 通过迭代器生成元素来填充切片，直到所有元素都被
    /// 初始化或迭代器为空。
    ///
    /// 返回两个切片。第一个切片包含原始切片的已初始化部分。
    /// 第二个切片是原始切片尚未初始化的剩余部分。
    ///
    /// # Panics
    ///
    /// This function panics if the iterator's `next` function panics.
    ///
    /// 如果发生此类 panic，此操作期间之前初始化的任何元素将被
    /// 丢弃。
    ///
    /// # Examples
    ///
    /// 完全填充切片：
    ///
    /// ```
    /// #![feature(maybe_uninit_fill)]
    /// use std::mem::MaybeUninit;
    ///
    /// let mut buf = [const { MaybeUninit::uninit() }; 5];
    ///
    /// let iter = [1, 2, 3].into_iter().cycle();
    /// let (initialized, remainder) = buf.write_iter(iter);
    ///
    /// assert_eq!(initialized, &mut [1, 2, 3, 1, 2]);
    /// assert_eq!(remainder.len(), 0);
    /// ```
    ///
    /// 部分填充切片：
    ///
    /// ```
    /// #![feature(maybe_uninit_fill)]
    /// use std::mem::MaybeUninit;
    ///
    /// let mut buf = [const { MaybeUninit::uninit() }; 5];
    /// let iter = [1, 2];
    /// let (initialized, remainder) = buf.write_iter(iter);
    ///
    /// assert_eq!(initialized, &mut [1, 2]);
    /// assert_eq!(remainder.len(), 3);
    /// ```
    ///
    /// 填充切片后检查迭代器：
    ///
    /// ```
    /// #![feature(maybe_uninit_fill)]
    /// use std::mem::MaybeUninit;
    ///
    /// let mut buf = [const { MaybeUninit::uninit() }; 3];
    /// let mut iter = [1, 2, 3, 4, 5].into_iter();
    /// let (initialized, remainder) = buf.write_iter(iter.by_ref());
    ///
    /// assert_eq!(initialized, &mut [1, 2, 3]);
    /// assert_eq!(remainder.len(), 0);
    /// assert_eq!(iter.as_slice(), &[4, 5]);
    /// ```
    #[unstable(feature = "maybe_uninit_fill", issue = "117428")]
    pub fn write_iter<I>(&mut self, it: I) -> (&mut [T], &mut [MaybeUninit<T>])
    where
        I: IntoIterator<Item = T>,
    {
        let iter = it.into_iter();
        let mut guard = Guard { slice: self, initialized: 0 };

        for (element, val) in guard.slice.iter_mut().zip(iter) {
            element.write(val);
            guard.initialized += 1;
        }

        let initialized_len = guard.initialized;
        super::forget(guard);

        // SAFETY: guard.initialized <= self.len()
        let (initted, remainder) = unsafe { self.split_at_mut_unchecked(initialized_len) };

        // SAFETY: Valid elements have just been written into `init`, so that portion
        // of `this` is initialized.
        (unsafe { initted.assume_init_mut() }, remainder)
    }

    /// Returns the contents of this `MaybeUninit` as a slice of potentially uninitialized bytes.
    ///
    /// Note that even if the contents of a `MaybeUninit` have been initialized, the value may still
    /// 包含未初始化的填充字节。
    ///
    /// This method requires `T: Freeze`. It's not available for types with interior mutability,
    /// such as `Cell<T>`.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(maybe_uninit_as_bytes)]
    /// use std::mem::MaybeUninit;
    ///
    /// let uninit = [MaybeUninit::new(0x1234u16), MaybeUninit::new(0x5678u16)];
    /// let uninit_bytes = uninit.as_bytes();
    /// let bytes = unsafe { uninit_bytes.assume_init_ref() };
    /// let val1 = u16::from_ne_bytes(bytes[0..2].try_into().unwrap());
    /// let val2 = u16::from_ne_bytes(bytes[2..4].try_into().unwrap());
    /// assert_eq!(&[val1, val2], &[0x1234u16, 0x5678u16]);
    /// ```
    #[unstable(feature = "maybe_uninit_as_bytes", issue = "93092")]
    pub const fn as_bytes(&self) -> &[MaybeUninit<u8>]
    where
        T: Freeze,
    {
        // SAFETY: MaybeUninit<u8> is always valid, even for padding bytes
        unsafe {
            slice::from_raw_parts(self.as_ptr().cast::<MaybeUninit<u8>>(), super::size_of_val(self))
        }
    }

    /// Returns the contents of this `MaybeUninit` slice as a mutable slice of potentially
    /// uninitialized bytes.
    ///
    /// Note that even if the contents of a `MaybeUninit` have been initialized, the value may still
    /// 包含未初始化的填充字节。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(maybe_uninit_as_bytes)]
    /// use std::mem::MaybeUninit;
    ///
    /// let mut uninit = [MaybeUninit::<u16>::uninit(), MaybeUninit::<u16>::uninit()];
    /// let uninit_bytes = uninit.as_bytes_mut();
    /// uninit_bytes.write_copy_of_slice(&[0x12, 0x34, 0x56, 0x78]);
    /// let vals = unsafe { uninit.assume_init_ref() };
    /// if cfg!(target_endian = "little") {
    ///     assert_eq!(vals, &[0x3412u16, 0x7856u16]);
    /// } else {
    ///     assert_eq!(vals, &[0x1234u16, 0x5678u16]);
    /// }
    /// ```
    #[unstable(feature = "maybe_uninit_as_bytes", issue = "93092")]
    pub const fn as_bytes_mut(&mut self) -> &mut [MaybeUninit<u8>] {
        // SAFETY: MaybeUninit<u8> is always valid, even for padding bytes
        unsafe {
            slice::from_raw_parts_mut(
                self.as_mut_ptr() as *mut MaybeUninit<u8>,
                super::size_of_val(self),
            )
        }
    }

    /// 将包含的值就地丢弃。
    ///
    /// # 安全性
    ///
    /// It is up to the caller to guarantee that every `MaybeUninit<T>` in the slice
    /// really is in an initialized state. Calling this when the content is not yet
    /// fully initialized causes undefined behavior.
    ///
    /// On top of that, all additional invariants of the type `T` must be
    /// satisfied, as the `Drop` implementation of `T` (or its members) may
    /// rely on this. For example, setting a `Vec<T>` to an invalid but
    /// non-null address makes it initialized (under the current implementation;
    /// 获取对包含值的可变（唯一）引用。
    /// requirement the compiler knows about it is that the data pointer must be
    /// non-null. Dropping such a `Vec<T>` however will cause undefined
    /// # 示例
    #[stable(feature = "maybe_uninit_slice", since = "1.93.0")]
    #[inline(always)]
    #[rustc_const_unstable(feature = "const_drop_in_place", issue = "109342")]
    pub const unsafe fn assume_init_drop(&mut self)
    where
        T: [const] Destruct,
    {
        if !self.is_empty() {
            // SAFETY: the caller must guarantee that every element of `self`
            // is initialized and satisfies all invariants of `T`.
            // Dropping the value in place is safe if that is the case.
            unsafe { ptr::drop_in_place(self as *mut [MaybeUninit<T>] as *mut [T]) }
        }
    }

    /// Gets a shared reference to the contained value.
    ///
    /// # 安全性
    ///
    /// Calling this when the content is not yet fully initialized causes undefined
    /// behavior: it is up to the caller to guarantee that every `MaybeUninit<T>` in
    /// the slice really is in an initialized state.
    #[stable(feature = "maybe_uninit_slice", since = "1.93.0")]
    #[rustc_const_stable(feature = "maybe_uninit_slice", since = "1.93.0")]
    #[inline(always)]
    pub const unsafe fn assume_init_ref(&self) -> &[T] {
        // SAFETY: casting `slice` to a `*const [T]` is safe since the caller guarantees that
        // `slice` is initialized, and `MaybeUninit` is guaranteed to have the same layout as `T`.
        // The pointer obtained is valid since it refers to memory owned by `slice` which is a
        // reference and thus guaranteed to be valid for reads.
        unsafe { &*(self as *const Self as *const [T]) }
    }

    /// Gets a mutable (unique) reference to the contained value.
    ///
    /// # 示例
    ///
    /// Calling this when the content is not yet fully initialized causes undefined
    /// behavior: it is up to the caller to guarantee that every `MaybeUninit<T>` in the
    /// slice really is in an initialized state. For instance, `.assume_init_mut()` cannot
    /// be used to initialize a `MaybeUninit` slice.
    #[stable(feature = "maybe_uninit_slice", since = "1.93.0")]
    #[rustc_const_stable(feature = "maybe_uninit_slice", since = "1.93.0")]
    #[inline(always)]
    pub const unsafe fn assume_init_mut(&mut self) -> &mut [T] {
        // SAFETY: similar to safety notes for `slice_get_ref`, but we have a
        // mutable reference which is also guaranteed to be valid for writes.
        unsafe { &mut *(self as *mut Self as *mut [T]) }
    }
}

impl<T, const N: usize> MaybeUninit<[T; N]> {
    /// Transposes a `MaybeUninit<[T; N]>` into a `[MaybeUninit<T>; N]`.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(maybe_uninit_uninit_array_transpose)]
    /// # use std::mem::MaybeUninit;
    ///
    /// let data: [MaybeUninit<u8>; 1000] = MaybeUninit::uninit().transpose();
    /// ```
    #[unstable(feature = "maybe_uninit_uninit_array_transpose", issue = "96097")]
    #[inline]
    pub const fn transpose(self) -> [MaybeUninit<T>; N] {
        // SAFETY: T and MaybeUninit<T> have the same layout
        unsafe { intrinsics::transmute_unchecked(self) }
    }
}

#[stable(feature = "more_conversion_trait_impls", since = "1.95.0")]
impl<T, const N: usize> From<[MaybeUninit<T>; N]> for MaybeUninit<[T; N]> {
    #[inline]
    fn from(arr: [MaybeUninit<T>; N]) -> Self {
        arr.transpose()
    }
}

#[stable(feature = "more_conversion_trait_impls", since = "1.95.0")]
impl<T, const N: usize> AsRef<[MaybeUninit<T>; N]> for MaybeUninit<[T; N]> {
    #[inline]
    fn as_ref(&self) -> &[MaybeUninit<T>; N] {
        // SAFETY: T and MaybeUninit<T> have the same layout
        unsafe { &*ptr::from_ref(self).cast() }
    }
}

#[stable(feature = "more_conversion_trait_impls", since = "1.95.0")]
impl<T, const N: usize> AsRef<[MaybeUninit<T>]> for MaybeUninit<[T; N]> {
    #[inline]
    fn as_ref(&self) -> &[MaybeUninit<T>] {
        AsRef::<[MaybeUninit<T>; N]>::as_ref(self)
    }
}

#[stable(feature = "more_conversion_trait_impls", since = "1.95.0")]
impl<T, const N: usize> AsMut<[MaybeUninit<T>; N]> for MaybeUninit<[T; N]> {
    #[inline]
    fn as_mut(&mut self) -> &mut [MaybeUninit<T>; N] {
        // SAFETY: T and MaybeUninit<T> have the same layout
        unsafe { &mut *ptr::from_mut(self).cast() }
    }
}

#[stable(feature = "more_conversion_trait_impls", since = "1.95.0")]
impl<T, const N: usize> AsMut<[MaybeUninit<T>]> for MaybeUninit<[T; N]> {
    #[inline]
    fn as_mut(&mut self) -> &mut [MaybeUninit<T>] {
        &mut *AsMut::<[MaybeUninit<T>; N]>::as_mut(self)
    }
}

#[stable(feature = "more_conversion_trait_impls", since = "1.95.0")]
impl<T, const N: usize> From<MaybeUninit<[T; N]>> for [MaybeUninit<T>; N] {
    #[inline]
    fn from(arr: MaybeUninit<[T; N]>) -> Self {
        arr.transpose()
    }
}

impl<T, const N: usize> [MaybeUninit<T>; N] {
    /// Transposes a `[MaybeUninit<T>; N]` into a `MaybeUninit<[T; N]>`.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(maybe_uninit_uninit_array_transpose)]
    /// # use std::mem::MaybeUninit;
    ///
    /// let data = [MaybeUninit::<u8>::uninit(); 1000];
    /// let data: MaybeUninit<[u8; 1000]> = data.transpose();
    /// ```
    #[unstable(feature = "maybe_uninit_uninit_array_transpose", issue = "96097")]
    #[inline]
    pub const fn transpose(self) -> MaybeUninit<[T; N]> {
        // SAFETY: T and MaybeUninit<T> have the same layout
        unsafe { intrinsics::transmute_unchecked(self) }
    }
}

struct Guard<'a, T> {
    slice: &'a mut [MaybeUninit<T>],
    initialized: usize,
}

impl<'a, T> Drop for Guard<'a, T> {
    fn drop(&mut self) {
        let initialized_part = &mut self.slice[..self.initialized];
        // SAFETY: this raw sub-slice will contain only initialized objects.
        unsafe {
            initialized_part.assume_init_drop();
        }
    }
}

trait SpecFill<T> {
    fn spec_fill(&mut self, value: T);
}

impl<T: Clone> SpecFill<T> for [MaybeUninit<T>] {
    default fn spec_fill(&mut self, value: T) {
        let mut guard = Guard { slice: self, initialized: 0 };

        if let Some((last, elems)) = guard.slice.split_last_mut() {
            for el in elems {
                el.write(value.clone());
                guard.initialized += 1;
            }

            last.write(value);
        }
        super::forget(guard);
    }
}

impl<T: TrivialClone> SpecFill<T> for [MaybeUninit<T>] {
    fn spec_fill(&mut self, value: T) {
        // SAFETY: because `T` is `TrivialClone`, this is equivalent to calling
        // `T::clone` for every element. Notably, `TrivialClone` also implies
        // that the `clone` implementation will not panic, so we can avoid
        // initialization guards and such.
        self.fill_with(|| MaybeUninit::new(unsafe { ptr::read(&value) }));
    }
}
