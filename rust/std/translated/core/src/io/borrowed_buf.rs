#![unstable(feature = "core_io_borrowed_buf", issue = "117693")]

use crate::fmt::{self, Debug, Formatter};
use crate::mem::MaybeUninit;
use crate::ptr::NonNull;
use crate::slice;

/// 一个最初未初始化的借用缓冲区，随后逐步填充。
///
/// This type makes it safer to work with `MaybeUninit` buffers, such as to read into a buffer
/// 它记录已填充的元素区域以及未填充区域是否已被初始化。
/// 总之，缓冲区的内容可以视为：
///
/// In summary, the contents of the buffer can be visualized as:
/// ```not_rust
/// [                capacity                ]
/// [ filled | unfilled (may be initialized) ]
/// ```
///
/// A `BorrowedBuf` is created around some existing elements (or capacity for elements) via a unique
/// reference (`&mut`). The `BorrowedBuf` can be configured (e.g., using `clear` or `set_init`), but
/// cannot be directly written. To write into the buffer, use `unfilled` to create a
/// `BorrowedCursor`. The cursor has write-only access to the unfilled portion of the buffer (you
/// 缓冲区的底层元素。
///
/// The lifetime `'data` is a bound on the lifetime of the underlying elements.
///
/// 是否整个未填充部分已被显式初始化。
pub struct BorrowedBuf<'data, T> {
    /// The buffer's underlying elements.
    buf: &'data mut [MaybeUninit<T>],
    /// The number of elements of `self.buf` that are known to be filled.
    filled: usize,
    /// Whether the entire unfilled part of `self.buf` has explicitly been initialized.
    init: bool,
}

impl<T> Debug for BorrowedBuf<'_, T> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        BorrowedBufDebug { init: self.init, filled: self.filled, capacity: self.capacity() }.fmt(f)
    }
}

struct BorrowedBufDebug {
    init: bool,
    filled: usize,
    capacity: usize,
}

impl Debug for BorrowedBufDebug {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        f.debug_struct("BorrowedBuf")
            .field("init", &self.init)
            .field("filled", &self.filled)
            .field("capacity", &self.capacity)
            .finish()
    }
}

/// Creates a new `BorrowedBuf` from a fully initialized slice.
impl<'data, T: Copy> From<&'data mut [T]> for BorrowedBuf<'data, T> {
    #[inline]
    fn from(slice: &'data mut [T]) -> BorrowedBuf<'data, T> {
        BorrowedBuf {
            // SAFETY: no initialized element is ever uninitialized as per `BorrowedBuf`'s invariant
            buf: unsafe { &mut *(slice as *mut [T] as *mut [MaybeUninit<T>]) },
            filled: 0,
            init: true,
        }
    }
}

/// Creates a new `BorrowedBuf` from an uninitialized buffer.
impl<'data, T: Copy> From<&'data mut [MaybeUninit<T>]> for BorrowedBuf<'data, T> {
    #[inline]
    fn from(buf: &'data mut [MaybeUninit<T>]) -> BorrowedBuf<'data, T> {
        BorrowedBuf { buf, filled: 0, init: false }
    }
}

/// Creates a new `BorrowedBuf` from a cursor.
///
/// Use `BorrowedCursor::with_unfilled_buf` instead for a safer alternative.
impl<'data, T: Copy> From<BorrowedCursor<'data, T>> for BorrowedBuf<'data, T> {
    #[inline]
    fn from(buf: BorrowedCursor<'data, T>) -> BorrowedBuf<'data, T> {
        let filled = buf.filled();
        let init = buf.is_buf_init();
        let len = buf.buf_len();
        BorrowedBuf {
            // SAFETY: no initialized element is ever uninitialized as per `BorrowedBuf`'s
            // invariant, and the cursor holds the unique access to those elements for `'data`
            buf: unsafe { slice::from_raw_parts_mut(buf.buf.as_ptr().add(filled), len - filled) },
            filled: 0,
            init,
        }
    }
}

impl<'data, T> BorrowedBuf<'data, T> {
    /// 返回缓冲区的共享引用。
    #[inline]
    pub fn capacity(&self) -> usize {
        self.buf.len()
    }

    /// 返回缓冲区的共享引用。
    #[inline]
    pub fn len(&self) -> usize {
        self.filled
    }

    /// Returns `true` if the buffer is initialized.
    #[unstable(feature = "borrowed_buf_init", issue = "160476")]
    #[inline]
    pub fn is_init(&self) -> bool {
        self.init
    }
}

impl<'data, T: Copy> BorrowedBuf<'data, T> {
    /// 返回缓冲区的填充部分的共享引用。
    #[inline]
    pub fn filled(&self) -> &[T] {
        // SAFETY: We only slice the filled part of the buffer, which is always valid
        unsafe {
            let buf = self.buf.get_unchecked(..self.filled);
            buf.assume_init_ref()
        }
    }

    /// 返回缓冲区的填充部分的可修改引用。
    #[inline]
    pub fn filled_mut(&mut self) -> &mut [T] {
        // SAFETY: We only slice the filled part of the buffer, which is always valid
        unsafe {
            let buf = self.buf.get_unchecked_mut(..self.filled);
            buf.assume_init_mut()
        }
    }

    /// 返回具有原始生命周期的缓冲区的填充部分的共享引用。
    #[inline]
    pub fn into_filled(self) -> &'data [T] {
        // SAFETY: We only slice the filled part of the buffer, which is always valid
        unsafe {
            let buf = self.buf.get_unchecked(..self.filled);
            buf.assume_init_ref()
        }
    }

    /// 返回具有原始生命周期的缓冲区的填充部分的可修改引用。
    #[inline]
    pub fn into_filled_mut(self) -> &'data mut [T] {
        // SAFETY: We only slice the filled part of the buffer, which is always valid
        unsafe {
            let buf = self.buf.get_unchecked_mut(..self.filled);
            buf.assume_init_mut()
        }
    }

    /// 返回缓冲区的未填充部分的光标。
    #[inline]
    pub fn unfilled<'this>(&'this mut self) -> BorrowedCursor<'this, T> {
        let borrowed_buf = NonNull::from_mut(self);
        BorrowedCursor { buf: NonNull::from_mut(self.buf).cast(), borrowed_buf }
    }

    /// 清空缓冲区，将已填充区域重置为空。
    ///
    /// 缓冲区的内容不会被修改。
    #[inline]
    pub fn clear(&mut self) -> &mut Self {
        self.filled = 0;
        self
    }

    /// 断言缓冲区的未填充部分已初始化。
    ///
    /// # 安全性
    ///
    /// 缓冲区的所有元素必须被初始化。
    #[unstable(feature = "borrowed_buf_init", issue = "160476")]
    #[inline]
    pub unsafe fn set_init(&mut self) -> &mut Self {
        self.init = true;
        self
    }
}

/// A writeable view of the unfilled portion of a [`BorrowedBuf`].
///
/// The unfilled portion may be uninitialized; see [`BorrowedBuf`] for details.
///
/// Data can be written directly to the cursor by using [`append`](BorrowedCursor::append) or
/// 间接通过获取光标的一部分或全部切片并写入该切片来直接将数据写入光标。
/// indirect case, the caller must call [`advance`](BorrowedCursor::advance) after writing to inform
/// 光标显示已写入了多少个元素。
///
/// Once elements are written to the cursor, they become part of the filled portion of the
/// underlying `BorrowedBuf` and can no longer be accessed or re-written by the cursor. In other
/// words, the cursor tracks the unfilled part of the underlying `BorrowedBuf`.
///
/// The lifetime `'a` is a bound on the lifetime of the underlying buffer (which means it is a bound
/// on the elements in that buffer by transitivity).
pub struct BorrowedCursor<'a, T> {
    /// 光标所创建的缓冲区的元素起始位置。
    /// Safety invariant: this points to the start of the *whole* buffer of `*borrowed_buf` and is
    /// valid for reads and writes of `(*borrowed_buf).buf.len()` elements, so that
    /// `(*borrowed_buf).filled` indexes into it.
    buf: NonNull<MaybeUninit<T>>,
    /// 光标所创建的缓冲区。
    /// 安全不变量：
    /// 1. `(*borrowed_buf).buf` is *never* accessed by the owner of the pointee while the `buf`
    ///    field above is alive, because there is a `&mut` of the pointee while the cursor is alive.
    /// 2. We promise to only access the `filled` and `init` fields and the metadata of the `buf`
    ///    field through the `borrowed_buf` pointer, never triggering any retag of `buf`'s pointer,
    ///    as the `buf` field above holds a reborrow of it and reaching the parent again would be a
    ///    foreign access for that reborrow. This includes not making a reference to the whole
    ///    pointee out of `borrowed_buf`, but only accessing those fields directly through pointer
    ///    manipulation.
    borrowed_buf: NonNull<BorrowedBuf<'a, T>>,
}

// SAFETY: A `BorrowedCursor<'a, T>` is a unique borrow of a `BorrowedBuf<'a, T>`, which is a
// `&'a mut [MaybeUninit<T>]` and two `Copy` fields. The `buf` raw pointer is used like
// `&mut [MaybeUninit<T>]` so `T: Send` -> `Send` and  is: `T: Sync` -> `Sync`, and the
// `borrowed_buf` only touches two `Copy` fields, without depending of `T`.
unsafe impl<T: Send> Send for BorrowedCursor<'_, T> {}
// SAFETY: See the `Send` impl above.
unsafe impl<T: Sync> Sync for BorrowedCursor<'_, T> {}

impl<T> Debug for BorrowedCursor<'_, T> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        let buf = BorrowedBufDebug {
            init: self.is_buf_init(),
            filled: self.filled(),
            capacity: self.buf_len(),
        };

        f.debug_struct("BorrowedCursor").field("buf", &buf).finish()
    }
}

// Helpers to access underlying buffer state.
impl<'a, T> BorrowedCursor<'a, T> {
    #[inline]
    fn buf_mut(&mut self) -> &mut [MaybeUninit<T>] {
        let len = self.buf_len();
        // SAFETY: `buf` points to `len` elements that this cursor borrows exclusively.
        unsafe { slice::from_raw_parts_mut(self.buf.as_ptr(), len) }
    }

    #[inline]
    fn buf_len(&self) -> usize {
        // SAFETY: We read just the metadata of `buf` and avoid retagging the reference.
        unsafe {
            let borrowed_buf = self.borrowed_buf.as_ptr();
            let buf_ptr: *const &'a mut [MaybeUninit<T>] = &raw const (*borrowed_buf).buf;
            // Same layout:
            // https://doc.rust-lang.org/reference/type-layout.html#r-layout.pointer.intro
            let buf_ptr: *const *const [MaybeUninit<T>] = buf_ptr.cast();
            let buf: *const [MaybeUninit<T>] = *buf_ptr;
            buf.len()
        }
    }

    #[inline]
    fn unfilled_slice(&mut self) -> &mut [MaybeUninit<T>] {
        let filled = self.filled();
        // SAFETY: always in bounds
        unsafe { self.buf_mut().get_unchecked_mut(filled..) }
    }

    #[inline]
    fn filled(&self) -> usize {
        // SAFETY: We access just `filled` and avoid foreign read on `buf`.
        unsafe { (*self.borrowed_buf.as_ptr()).filled }
    }

    #[inline]
    fn is_buf_init(&self) -> bool {
        // SAFETY: We access just `init` and avoid foreign read on `buf`.
        unsafe { (*self.borrowed_buf.as_ptr()).init }
    }

    /// # 安全性
    ///
    /// In case of `true` all the elements of the cursor must be initialized.
    #[inline]
    unsafe fn set_buf_init(&mut self, init: bool) {
        // SAFETY: We access just `init` and avoid foreign read on `buf`.
        unsafe {
            (*self.borrowed_buf.as_ptr()).init = init;
        }
    }

    /// # 安全性
    ///
    /// The next `n` elements of the cursor must be initialized.
    #[inline]
    unsafe fn add_filled(&mut self, n: usize) {
        // SAFETY: We access just `filled` and avoid foreign read on `buf`.
        unsafe {
            (*self.borrowed_buf.as_ptr()).filled += n;
        }
    }
}

impl<'a, T: Copy> BorrowedCursor<'a, T> {
    /// 通过克隆具有较小生命周期的光标来再借用此光标。
    ///
    /// 由于光标对其底层缓冲区拥有唯一的访问权，被借用的光标在新光标存在时无法访问。
    /// 在新光标存在时，无法访问被借用的光标。
    #[inline]
    pub fn reborrow<'this>(&'this mut self) -> BorrowedCursor<'this, T> {
        BorrowedCursor { buf: self.buf, borrowed_buf: self.borrowed_buf }
    }

    /// 返回光标的可用空间。
    #[inline]
    pub fn capacity(&self) -> usize {
        self.buf_len() - self.filled()
    }

    /// Returns the number of elements written to the `BorrowedBuf` this cursor was created from.
    ///
    /// 特别是，返回的计数被所有再借用的光标共享。
    #[inline]
    pub fn written(&self) -> usize {
        self.filled()
    }

    /// Returns `true` if the buffer is initialized.
    #[unstable(feature = "borrowed_buf_init", issue = "160476")]
    #[inline]
    pub fn is_init(&self) -> bool {
        self.is_buf_init()
    }

    /// 将缓冲区设置为完全初始化状态。
    ///
    /// # 安全性
    ///
    /// 光标的所有元素必须被初始化。
    #[unstable(feature = "borrowed_buf_init", issue = "160476")]
    #[inline]
    pub unsafe fn set_init(&mut self) {
        // SAFETY: the caller guarantees that all the elements of the cursor are initialized.
        unsafe { self.set_buf_init(true) }
    }

    /// 返回对整个光标的可修改引用。
    ///
    /// # 安全性
    ///
    /// 如果光标已初始化，调用者不得取消初始化光标的任何元素。
    #[inline]
    pub unsafe fn as_mut(&mut self) -> &mut [MaybeUninit<T>] {
        self.unfilled_slice()
    }

    /// Advances the cursor by asserting that `n` elements have been filled.
    ///
    /// After advancing, the `n` elements are no longer accessible via the cursor and can only be
    /// accessed via the underlying buffer. I.e., the buffer's filled portion grows by `n` elements
    /// and its unfilled portion (and the capacity of this cursor) shrinks by `n` elements.
    ///
    /// If less than `n` elements initialized (by the cursor's point of view), `set_init` should be
    /// called first.
    ///
    /// # 恐慌
    ///
    /// Panics if there are less than `n` elements initialized.
    #[unstable(feature = "borrowed_buf_init", issue = "160476")]
    #[inline]
    pub fn advance_checked(&mut self, n: usize) -> &mut Self {
        // The subtraction cannot underflow by invariant of this type.
        let init_unfilled = if self.is_buf_init() { self.buf_len() - self.filled() } else { 0 };
        assert!(n <= init_unfilled);

        // SAFETY: the next `n` elements are initialized, as asserted above.
        unsafe { self.advance(n) };
        self
    }

    /// Advances the cursor by asserting that `n` elements have been filled.
    ///
    /// After advancing, the `n` elements are no longer accessible via the cursor and can only be
    /// accessed via the underlying buffer. I.e., the buffer's filled portion grows by `n` elements
    /// and its unfilled portion (and the capacity of this cursor) shrinks by `n` elements.
    ///
    /// # 安全性
    ///
    /// The caller must ensure that the first `n` elements of the cursor have been initialized.
    #[inline]
    pub unsafe fn advance(&mut self, n: usize) -> &mut Self {
        // SAFETY: the caller guarantees that the first `n` elements of the cursor are initialized.
        unsafe { self.add_filled(n) };
        self
    }

    /// 向光标添加元素，从而在其缓冲区内推进位置。
    ///
    /// # 恐慌
    ///
    /// Panics if `self.capacity()` is less than `buf.len()`.
    #[inline]
    pub fn append(&mut self, buf: &[T]) {
        assert!(self.capacity() >= buf.len());

        // SAFETY: we do not de-initialize any of the elements of the slice
        unsafe {
            self.as_mut()[..buf.len()].write_copy_of_slice(buf);
        }

        // SAFETY: these elements have just been initialized.
        unsafe { self.advance(buf.len()) };
    }

    /// Runs the given closure with a `BorrowedBuf` containing the unfilled part
    /// 这使得可以检查已写入光标的内容。
    ///
    /// # 恐慌
    ///
    /// # Panics
    ///
    /// Panics if the `BorrowedBuf` given to the closure is replaced by another
    /// 将光标中的所有元素初始化为默认值并
    pub fn with_unfilled_buf<R>(&mut self, f: impl FnOnce(&mut BorrowedBuf<'_, T>) -> R) -> R {
        let mut buf = BorrowedBuf::from(self.reborrow());
        let prev_ptr = buf.buf as *const _;
        let res = f(&mut buf);

        // Check that the caller didn't replace the `BorrowedBuf`.
        // This is necessary for the safety of the code below: if the check wasn't
        // there, one could mark some elements as initialized even though they aren't.
        assert!(core::ptr::eq(prev_ptr, buf.buf));

        let filled = buf.filled;
        let init = buf.init;

        // Update `init` and `filled` fields with what was written to the buffer.
        // `self.buf.filled` was the starting length of the `BorrowedBuf`.
        //
        // SAFETY: These elements were initialized/filled in the `BorrowedBuf`, and therefore they
        // are initialized/filled in the cursor too, because the buffer wasn't replaced.
        unsafe {
            self.set_buf_init(init);
            self.advance(filled);
        }

        res
    }
}

impl<'a, T: Default + Copy> BorrowedCursor<'a, T> {
    /// 返回这些元素。
    /// returns them.
    #[unstable(feature = "borrowed_buf_init", issue = "160476")]
    #[inline]
    pub fn ensure_init(&mut self) -> &mut [T] {
        if !self.is_buf_init() {
            self.unfilled_slice().write_default();
            // SAFETY: buf is now initialized.
            unsafe { self.set_buf_init(true) };
        }

        // SAFETY: these elements have just been initialized if they weren't before
        unsafe { self.unfilled_slice().assume_init_mut() }
    }
}
