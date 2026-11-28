#![allow(unused)]

use fortanix_sgx_abi::*;

use super::super::mem::{is_enclave_range, is_user_range};
use crate::arch::asm;
use crate::cell::UnsafeCell;
use crate::convert::TryInto;
use crate::mem::{self, ManuallyDrop, MaybeUninit};
use crate::ops::{CoerceUnsized, Deref, DerefMut, Index, IndexMut};
use crate::ptr::{self, NonNull};
use crate::slice::SliceIndex;
use crate::{cmp, intrinsics, slice};

/// 一种可以安全地在用户空间读取或写入的类型。
///
/// 关于读取和写入的具体要求列表（非完全列举）：
/// * **Type is `Copy`** (and therefore also not `Drop`). Copies will be
/// 生成。
/// * **No references or Rust-style owned pointers** (`Vec`, `Arc`, etc.). When
/// 引用。
/// 此外，只有闭包内存由 Rust 编译器的静态分析管理。从用户空间读取时，无法保证 值正确符合该类型的期望。
///   compiler's static analysis. When reading from userspace, there can be no
///   guarantee that the value correctly adheres to the expectations of the
/// * **没有胖指针**。从用户空间读取时，大小或 vtable 指针可以被代码自动解析和使用。当 向用户空间写入时，闭包内存中的数据内存地址（如 vtable 指针）不得因保密原因而泄露。
///   memory must not be leaked for confidentiality reasons. `User` and
///   `UserRef` are also not allowed for the same reasons.
/// 关于向用户空间写入的具体要求列表（非完全列举）：
/// * **没有指向闭包内存的指针**。闭包内存中的数据内存地址 不得因保密原因而泄露。
/// * **没有内部填充**。填充内容可能包含之前初始化的 该内存位置存储的机密数据，不得因保密原因而泄露。
/// 因此必须避免泄露。
///
/// Non-exhaustive list of specific requirements for reading from userspace:
/// * **Any bit pattern is valid** for this type (no `enum`s). There can be no
///   guarantee that the value correctly adheres to the expectations of the
/// 注意，这里需要大小，而不是长度！
///
/// # 安全性
/// 调用者必须确保内存范围位于用户内存中，大小正确，对齐正确，并指向正确的类型。
///   memory must not be leaked for confidentiality reasons.
/// 注意，这里需要大小，而不是长度！
/// # 安全性
/// 调用者必须确保内存范围指向正确的类型。
#[unstable(feature = "sgx_platform", issue = "56975")]
pub unsafe trait UserSafeSized: Copy + Sized {}

#[unstable(feature = "sgx_platform", issue = "56975")]
unsafe impl UserSafeSized for u8 {}
#[unstable(feature = "sgx_platform", issue = "56975")]
unsafe impl<T> UserSafeSized for FifoDescriptor<T> {}
#[unstable(feature = "sgx_platform", issue = "56975")]
unsafe impl UserSafeSized for ByteBuffer {}
#[unstable(feature = "sgx_platform", issue = "56975")]
unsafe impl UserSafeSized for Usercall {}
#[unstable(feature = "sgx_platform", issue = "56975")]
unsafe impl UserSafeSized for Return {}
#[unstable(feature = "sgx_platform", issue = "56975")]
unsafe impl UserSafeSized for Cancel {}
#[unstable(feature = "sgx_platform", issue = "56975")]
unsafe impl<T: UserSafeSized> UserSafeSized for [T; 2] {}

/// A type that can be represented in memory as one or more `UserSafeSized`s.
#[unstable(feature = "sgx_platform", issue = "56975")]
pub unsafe trait UserSafe {
    /// Equivalent to `align_of::<Self>`.
    fn align_of() -> usize;

    /// Constructs a pointer to `Self` given a memory range in user space.
    ///
    /// 注意，这里需要大小，而不是长度！
    ///
    /// # 安全性
    ///
    /// 调用者必须确保内存范围位于用户内存中，大小正确且对齐正确，并指向正确的类型。
    /// correct size and is correctly aligned and points to the right type.
    unsafe fn from_raw_sized_unchecked(ptr: *mut u8, size: usize) -> *mut Self;

    /// Constructs a pointer to `Self` given a memory range.
    ///
    /// 注意，这里需要大小，而不是长度！
    ///
    /// # 安全性
    ///
    /// 调用者必须确保内存范围指向正确的类型。
    ///
    /// # 异常
    ///
    /// 如果以下情况发生，此函数会引发异常：
    ///
    /// * 指针未对齐。
    /// * 指针为 null。
    /// * 指向的范围无法适应地址空间。
    /// * 指向的范围不在用户内存中。
    unsafe fn from_raw_sized(ptr: *mut u8, size: usize) -> NonNull<Self> {
        assert!(ptr.wrapping_add(size) >= ptr);
        // SAFETY: The caller has guaranteed the pointer is valid
        let ret = unsafe { Self::from_raw_sized_unchecked(ptr, size) };
        unsafe {
            Self::check_ptr(ret);
            NonNull::new_unchecked(ret as _)
        }
    }

    /// Checks if a pointer may point to `Self` in user memory.
    ///
    /// # 安全性
    ///
    /// 调用者必须确保内存范围指向正确的类型和
    /// 长度（如果是切片的话）。
    ///
    /// # 异常
    ///
    /// 如果以下情况发生，此函数会引发异常：
    ///
    /// * 指针未对齐。
    /// * 指针为 null。
    /// * 指向的范围不在用户内存中。
    unsafe fn check_ptr(ptr: *const Self) {
        let is_aligned = |p: *const u8| -> bool { p.is_aligned_to(Self::align_of()) };

        assert!(is_aligned(ptr as *const u8));
        assert!(is_user_range(ptr as _, size_of_val(unsafe { &*ptr })));
        assert!(!ptr.is_null());
    }
}

#[unstable(feature = "sgx_platform", issue = "56975")]
unsafe impl<T: UserSafeSized> UserSafe for T {
    fn align_of() -> usize {
        align_of::<T>()
    }

    unsafe fn from_raw_sized_unchecked(ptr: *mut u8, size: usize) -> *mut Self {
        assert_eq!(size, size_of::<T>());
        ptr as _
    }
}

#[unstable(feature = "sgx_platform", issue = "56975")]
unsafe impl<T: UserSafeSized> UserSafe for [T] {
    fn align_of() -> usize {
        align_of::<T>()
    }

    /// # 异常
    ///
    /// 如果以下情况发生，此函数会引发异常：
    ///
    /// * the element size is not a factor of the size
    unsafe fn from_raw_sized_unchecked(ptr: *mut u8, size: usize) -> *mut Self {
        let elem_size = size_of::<T>();
        assert_eq!(size % elem_size, 0);
        let len = size / elem_size;
        ptr.cast::<T>().cast_slice(len)
    }
}

/// A reference to some type in userspace memory. `&UserRef<T>` is equivalent
/// to `&T` in enclave memory. Access to the memory is only allowed by copying
/// 以避免 TOCTTOU 问题。复制后，代码应确保在使用前完全检查该值。
/// check the value before use.
///
/// It is also possible to obtain a mutable reference `&mut UserRef<T>`. Unlike
/// 仅用于表示意图：可修改引用用于写入用户内存，不可修改引用用于从用户内存读取。
/// write to the backing memory at any time, so it can't be assumed that there
/// the pointed-to memory is uniquely borrowed. The two different reference types
/// TOCTTOU 问题。当值被丢弃时，用户内存将被释放。
/// 复制后，代码应确保在使用前完全检查该值。
#[unstable(feature = "sgx_platform", issue = "56975")]
#[repr(transparent)]
pub struct UserRef<T: ?Sized>(UnsafeCell<T>);
/// An owned type in userspace memory. `User<T>` is equivalent to `Box<T>` in
/// # 安全性
/// TOCTTOU issues. The user memory will be freed when the value is dropped.
/// 返回一个指针，用于写入该值。
/// use.
#[unstable(feature = "sgx_platform", issue = "56975")]
pub struct User<T: UserSafe + ?Sized>(NonNull<UserRef<T>>);

#[unstable(feature = "sgx_platform", issue = "56975")]
unsafe impl<T: UserSafeSized> Send for User<T> {}

#[unstable(feature = "sgx_platform", issue = "56975")]
unsafe impl<T: UserSafeSized> Send for User<[T]> {}

trait NewUserRef<T: ?Sized> {
    unsafe fn new_userref(v: T) -> Self;
}

impl<T: ?Sized> NewUserRef<*mut T> for NonNull<UserRef<T>> {
    unsafe fn new_userref(v: *mut T) -> Self {
        // SAFETY: The caller has guaranteed the pointer is valid
        unsafe { NonNull::new_unchecked(v as _) }
    }
}

impl<T: ?Sized> NewUserRef<NonNull<T>> for NonNull<UserRef<T>> {
    unsafe fn new_userref(v: NonNull<T>) -> Self {
        // SAFETY: The caller has guaranteed the pointer is valid
        unsafe { NonNull::new_userref(v.as_ptr()) }
    }
}

/// A type which can a destination for safely copying from userspace.
///
/// # 安全性
///
/// Requires that `T` and `Self` have identical layouts.
#[unstable(feature = "sgx_platform", issue = "56975")]
pub unsafe trait UserSafeCopyDestination<T: ?Sized> {
    /// 返回一个指针，用于写入该值。
    fn as_mut_ptr(&mut self) -> *mut T;
}

#[unstable(feature = "sgx_platform", issue = "56975")]
unsafe impl<T> UserSafeCopyDestination<T> for T {
    fn as_mut_ptr(&mut self) -> *mut T {
        self as _
    }
}

#[unstable(feature = "sgx_platform", issue = "56975")]
unsafe impl<T> UserSafeCopyDestination<[T]> for [T] {
    fn as_mut_ptr(&mut self) -> *mut [T] {
        self as _
    }
}

#[unstable(feature = "sgx_platform", issue = "56975")]
unsafe impl<T> UserSafeCopyDestination<T> for MaybeUninit<T> {
    fn as_mut_ptr(&mut self) -> *mut T {
        self as *mut Self as _
    }
}

#[unstable(feature = "sgx_platform", issue = "56975")]
unsafe impl<T> UserSafeCopyDestination<[T]> for [MaybeUninit<T>] {
    fn as_mut_ptr(&mut self) -> *mut [T] {
        self as *mut Self as _
    }
}

#[unstable(feature = "sgx_platform", issue = "56975")]
impl<T: ?Sized> User<T>
where
    T: UserSafe,
{
    // This function returns memory that is practically uninitialized, but is
    // not considered "unspecified" or "undefined" for purposes of an
    // optimizing compiler. This is achieved by returning a pointer from
    // from outside as obtained by `super::alloc`.
    fn new_uninit_bytes(size: usize) -> Self {
        unsafe {
            // Mustn't call alloc with size 0.
            let ptr = if size > 0 {
                rtunwrap!(Ok, super::alloc(size, T::align_of())) as _
            } else {
                crate::ptr::dangling_mut() // dangling pointer ok for size 0
            };
            if let Ok(v) = crate::panic::catch_unwind(|| T::from_raw_sized(ptr, size)) {
                User(NonNull::new_userref(v))
            } else {
                rtabort!("Got invalid pointer from alloc() usercall")
            }
        }
    }

    /// Copies `val` into freshly allocated space in user memory.
    pub fn new_from_enclave(val: &T) -> Self {
        unsafe {
            let mut user = Self::new_uninit_bytes(size_of_val(val));
            user.copy_from_enclave(val);
            user
        }
    }

    /// Creates an owned `User<T>` from a raw pointer.
    ///
    /// # 安全性
    /// The caller must ensure `ptr` points to `T`, is freeable with the `free`
    /// usercall and the alignment of `T`, and is uniquely owned.
    ///
    /// # 异常
    /// 如果以下情况发生，此函数会引发异常：
    ///
    /// * 指针未对齐。
    /// * 指针为 null。
    /// * 指向的范围不在用户内存中。
    pub unsafe fn from_raw(ptr: *mut T) -> Self {
        // SAFETY: the caller must uphold the safety contract for `from_raw`.
        unsafe { T::check_ptr(ptr) };
        User(unsafe { NonNull::new_userref(ptr) })
    }

    /// 将该值转换为原始指针。该值将不再被自动释放。
    /// automatically freed.
    pub fn into_raw(self) -> *mut T {
        ManuallyDrop::new(self).0.as_ptr() as _
    }
}

#[unstable(feature = "sgx_platform", issue = "56975")]
impl<T> User<T>
where
    T: UserSafe,
{
    /// Allocates space for `T` in user memory.
    pub fn uninitialized() -> Self {
        Self::new_uninit_bytes(size_of::<T>())
    }
}

#[unstable(feature = "sgx_platform", issue = "56975")]
impl<T> User<[T]>
where
    [T]: UserSafe,
{
    /// Allocates space for a `[T]` of `n` elements in user memory.
    pub fn uninitialized(n: usize) -> Self {
        Self::new_uninit_bytes(n * size_of::<T>())
    }

    /// Creates an owned `User<[T]>` from a raw thin pointer and a slice length.
    ///
    /// # 安全性
    /// The caller must ensure `ptr` points to `len` elements of `T`, is
    /// freeable with the `free` usercall and the alignment of `T`, and is
    /// 具有唯一所有权。
    ///
    /// # 恐慌
    /// 如果满足以下情况，此函数会触发恐慌：
    ///
    /// * 指针未对齐
    /// * 指针为 null
    /// * 指向的范围无法适应地址空间
    /// * 指向的范围不在用户内存中
    pub unsafe fn from_raw_parts(ptr: *mut T, len: usize) -> Self {
        User(unsafe { NonNull::new_userref(<[T]>::from_raw_sized(ptr as _, len * size_of::<T>())) })
    }
}

/// Divide the slice `(ptr, len)` into three parts, where the middle part is
/// aligned to `u64`.
///
/// The return values `(prefix_len, mid_len, suffix_len)` add back up to `len`.
/// The return values are such that the memory region `(ptr + prefix_len,
/// mid_len)` is the largest possible region where `ptr + prefix_len` is aligned
/// to `u64` and `mid_len` is a multiple of the byte size of `u64`. This means
/// that `prefix_len` and `suffix_len` are guaranteed to be less than the byte
/// size of `u64`, and that `(ptr, prefix_len)` and `(ptr + prefix_len +
/// - 以 VERW 指令开头，以 MFENCE 或 LFENCE 指令结尾
// Standard Rust functions such as `<[u8]>::align_to::<u64>` and
// `<*const u8>::align_offset` aren't _guaranteed_ to compute the largest
// possible middle region, and as such can't be used.
fn u64_align_to_guaranteed(ptr: *const u8, mut len: usize) -> (usize, usize, usize) {
    const QWORD_SIZE: usize = size_of::<u64>();

    let offset = ptr as usize % QWORD_SIZE;

    let prefix_len = if intrinsics::unlikely(offset > 0) { QWORD_SIZE - offset } else { 0 };

    len = match len.checked_sub(prefix_len) {
        Some(remaining_len) => remaining_len,
        None => return (len, 0, 0),
    };

    let suffix_len = len % QWORD_SIZE;
    len -= suffix_len;

    (prefix_len, len, suffix_len)
}

unsafe fn copy_quadwords(src: *const u8, dst: *mut u8, len: usize) {
    unsafe {
        asm!(
            "rep movsq (%rsi), (%rdi)",
            inout("rcx") len / 8 => _,
            inout("rdi") dst => _,
            inout("rsi") src => _,
            options(att_syntax, nostack, preserves_flags)
        );
    }
}

/// Copies `len` bytes of data from enclave pointer `src` to userspace `dst`
///
/// # 恐慌
/// 此函数如果满足以下情况则触发恐慌：
///  - or are in multiples of 8 bytes, aligned to an 8-byte boundary
///
/// # 恐慌
/// 此函数如果满足以下情况则触发恐慌：
///
/// * The `src` pointer is null
/// * The `dst` pointer is null
/// * The `src` memory range is not in enclave memory
/// * The `dst` memory range is not in user memory
///
/// # 参考
/// - https://www.intel.com/content/www/us/en/security-center/advisory/intel-sa-00615.html
/// - https://www.intel.com/content/www/us/en/developer/articles/technical/software-security-guidance/technical-documentation/processor-mmio-stale-data-vulnerabilities.html#inpage-nav-3-2-2
pub(crate) unsafe fn copy_to_userspace(src: *const u8, dst: *mut u8, len: usize) {
    /// Like `ptr::copy(src, dst, len)`, except it uses the Intel-recommended
    /// 未对齐写入指令序列。
    unsafe fn write_bytewise_to_userspace(src: *const u8, dst: *mut u8, len: usize) {
        if intrinsics::likely(len == 0) {
            return;
        }

        unsafe {
            let mut seg_sel: u16 = 0;
            for off in 0..len {
                asm!("
                    mov %ds, ({seg_sel})
                    verw ({seg_sel})
                    movb {val}, ({dst})
                    mfence
                    lfence
                    ",
                    val = in(reg_byte) *src.add(off),
                    dst = in(reg) dst.add(off),
                    seg_sel = in(reg) &mut seg_sel,
                    options(nostack, att_syntax)
                );
            }
        }
    }

    assert!(!src.is_null());
    assert!(!dst.is_null());
    assert!(is_enclave_range(src, len));
    assert!(is_user_range(dst, len));
    assert!(len < isize::MAX as usize);
    assert!(!src.addr().overflowing_add(len).1);
    assert!(!dst.addr().overflowing_add(len).1);

    unsafe {
        let (len1, len2, len3) = u64_align_to_guaranteed(dst, len);
        let (src1, dst1) = (src, dst);
        let (src2, dst2) = (src1.add(len1), dst1.add(len1));
        let (src3, dst3) = (src2.add(len2), dst2.add(len2));

        write_bytewise_to_userspace(src1, dst1, len1);
        copy_quadwords(src2, dst2, len2);
        write_bytewise_to_userspace(src3, dst3, len3);
    }
}

/// Copies `len` bytes of data from userspace pointer `src` to enclave pointer `dst`
///
/// 此函数通过确保所有从不可信内存读取的数据都对齐为 8 字节来减轻 AEPIC 泄露漏洞。
///
/// # 恐慌
/// 此函数如果满足以下情况则触发恐慌：
///
/// * The `src` pointer is null
/// * The `dst` pointer is null
/// * The `src` memory range is not in user memory
/// * The `dst` memory range is not in enclave memory
///
/// # 引用
/// - https://www.intel.com/content/www/us/en/security-center/advisory/intel-sa-00657.html
/// - https://www.intel.com/content/www/us/en/developer/articles/technical/software-security-guidance/advisory-guidance/stale-data-read-from-xapic.html
pub(crate) unsafe fn copy_from_userspace(src: *const u8, dst: *mut u8, len: usize) {
    /// Like `ptr::copy(src, dst, len)`, except it uses only u64-aligned reads.
    ///
    /// # 安全性
    /// 源内存区域不得跨越对齐边界。
    unsafe fn read_misaligned_from_userspace(src: *const u8, dst: *mut u8, len: usize) {
        if intrinsics::likely(len == 0) {
            return;
        }

        unsafe {
            let offset: usize;
            let data: u64;
            // doing a memory read that's potentially out of bounds for `src`,
            // this isn't supported by Rust, so have to use assembly
            asm!("
                movl {src:e}, {offset:e}
                andl $7, {offset:e}
                andq $-8, {src}
                movq ({src}), {dst}
                ",
                src = inout(reg) src => _,
                offset = out(reg) offset,
                dst = out(reg) data,
                options(nostack, att_syntax, readonly, pure)
            );
            let data = data.to_le_bytes();
            ptr::copy_nonoverlapping(data.as_ptr().add(offset), dst, len);
        }
    }

    assert!(!src.is_null());
    assert!(!dst.is_null());
    assert!(is_user_range(src, len));
    assert!(is_enclave_range(dst, len));
    assert!(len < isize::MAX as usize);
    assert!(!(src as usize).overflowing_add(len).1);
    assert!(!(dst as usize).overflowing_add(len).1);

    unsafe {
        let (len1, len2, len3) = u64_align_to_guaranteed(src, len);
        let (src1, dst1) = (src, dst);
        let (src2, dst2) = (src1.add(len1), dst1.add(len1));
        let (src3, dst3) = (src2.add(len2), dst2.add(len2));

        read_misaligned_from_userspace(src1, dst1, len1);
        copy_quadwords(src2, dst2, len2);
        read_misaligned_from_userspace(src3, dst3, len3);
    }
}

#[unstable(feature = "sgx_platform", issue = "56975")]
impl<T: ?Sized> UserRef<T>
where
    T: UserSafe,
{
    /// Creates a `&UserRef<[T]>` from a raw pointer.
    ///
    /// # 安全性
    /// The caller must ensure `ptr` points to `T`.
    ///
    /// # Panics
    /// 如果满足以下情况，此函数会触发 panic：
    ///
    /// * 指针未对齐
    /// * 指针为 null
    /// * 指向的范围不在用户内存中
    pub unsafe fn from_ptr<'a>(ptr: *const T) -> &'a Self {
        // SAFETY: The caller must uphold the safety contract for `from_ptr`.
        unsafe { T::check_ptr(ptr) };
        unsafe { &*(ptr as *const Self) }
    }

    /// Creates a `&mut UserRef<[T]>` from a raw pointer. See the struct
    /// documentation for the nuances regarding a `&mut UserRef<T>`.
    ///
    /// # 安全性
    /// The caller must ensure `ptr` points to `T`.
    ///
    /// # Panics
    /// 如果满足以下情况，此函数会触发 panic：
    ///
    /// * 指针未对齐
    /// * 指针为 null
    /// * 指向的范围不在用户内存中
    pub unsafe fn from_mut_ptr<'a>(ptr: *mut T) -> &'a mut Self {
        // SAFETY: The caller must uphold the safety contract for `from_mut_ptr`.
        unsafe { T::check_ptr(ptr) };
        unsafe { &mut *(ptr as *mut Self) }
    }

    /// Copies `val` into user memory.
    ///
    /// # Panics
    /// 如果目标地址的大小与源地址不同，此函数会触发 panic。这种情况可能发生在如切片这样的动态大小类型中。
    /// the source. This can happen for dynamically-sized types such as slices.
    pub fn copy_from_enclave(&mut self, val: &T) {
        unsafe {
            assert_eq!(size_of_val(val), size_of_val(&*self.0.get()));
            copy_to_userspace(
                val as *const T as *const u8,
                self.0.get() as *mut T as *mut u8,
                size_of_val(val),
            );
        }
    }

    /// Copies the value from user memory and place it into `dest`.
    ///
    /// # 如果目标地址的大小与源地址不同，此函数会触发 panic。这种情况可能发生在如切片这样的动态大小类型中。
    /// 从此引用获取原始指针。
    /// 从此引用获取原始指针。
    pub fn copy_to_enclave<U: ?Sized + UserSafeCopyDestination<T>>(&self, dest: &mut U) {
        unsafe {
            assert_eq!(size_of_val(dest), size_of_val(&*self.0.get()));
            copy_from_userspace(
                self.0.get() as *const T as *const u8,
                dest.as_mut_ptr() as *mut u8,
                size_of_val(dest),
            );
        }
    }

    /// 从此引用获取原始指针。
    pub fn as_raw_ptr(&self) -> *const T {
        self as *const _ as _
    }

    /// 从此引用获取原始指针。
    pub fn as_raw_mut_ptr(&mut self) -> *mut T {
        self as *mut _ as _
    }
}

#[unstable(feature = "sgx_platform", issue = "56975")]
impl<T> UserRef<T>
where
    T: UserSafe,
{
    /// 将用户内存中的值复制到保护区内存中。
    pub fn to_enclave(&self) -> T {
        unsafe {
            let mut data = mem::MaybeUninit::uninit();
            copy_from_userspace(self.0.get() as _, data.as_mut_ptr() as _, size_of::<T>());
            data.assume_init()
        }
    }
}

#[unstable(feature = "sgx_platform", issue = "56975")]
impl<T> UserRef<[T]>
where
    [T]: UserSafe,
{
    /// Creates a `&UserRef<[T]>` from a raw thin pointer and a slice length.
    ///
    /// # 安全性
    /// The caller must ensure `ptr` points to `n` elements of `T`.
    ///
    /// # Panics
    /// 如果满足以下情况，此函数会触发 panic：
    ///
    /// * 指针未对齐
    /// * 指针为 null
    /// * 指向的范围无法适应地址空间
    /// * 指向的范围不在用户内存中
    pub unsafe fn from_raw_parts<'a>(ptr: *const T, len: usize) -> &'a Self {
        // SAFETY: The caller must uphold the safety contract for `from_raw_parts`.
        unsafe { &*(<[T]>::from_raw_sized(ptr as _, len * size_of::<T>()).as_ptr() as *const Self) }
    }

    /// Creates a `&mut UserRef<[T]>` from a raw thin pointer and a slice length.
    /// 请参阅结构体的文档以了解相关细节。
    /// `&mut UserRef<T>`.
    ///
    /// # 安全性
    /// The caller must ensure `ptr` points to `n` elements of `T`.
    ///
    /// # Panics
    /// 如果满足以下情况，此函数会触发 panic：
    ///
    /// * 指针未对齐
    /// * 指针为 null
    /// * 指向的范围无法适应地址空间
    /// * 指向的范围不在用户内存中
    pub unsafe fn from_raw_parts_mut<'a>(ptr: *mut T, len: usize) -> &'a mut Self {
        // SAFETY: The caller must uphold the safety contract for `from_raw_parts_mut`.
        unsafe {
            &mut *(<[T]>::from_raw_sized(ptr as _, len * size_of::<T>()).as_ptr() as *mut Self)
        }
    }

    /// 获取该用户切片第一个元素的原始指针。
    pub fn as_ptr(&self) -> *const T {
        self.0.get() as _
    }

    /// 获取该用户切片第一个元素的原始指针。
    pub fn as_mut_ptr(&mut self) -> *mut T {
        self.0.get() as _
    }

    /// 获取该用户切片中的元素数量。
    pub fn len(&self) -> usize {
        unsafe { self.0.get().len() }
    }

    /// Copies the value from user memory and appends it to `dest`.
    pub fn append_to_enclave_vec(&self, dest: &mut Vec<T>) {
        dest.reserve(self.len());
        self.copy_to_enclave(&mut dest.spare_capacity_mut()[..self.len()]);
        // SAFETY: We reserve enough space above.
        unsafe { dest.set_len(dest.len() + self.len()) };
    }

    /// 将用户内存中的值复制到封装内存中的向量中。
    pub fn to_enclave(&self) -> Vec<T> {
        let mut ret = Vec::with_capacity(self.len());
        self.append_to_enclave_vec(&mut ret);
        ret
    }

    /// 返回该切片的迭代器。
    pub fn iter(&self) -> Iter<'_, T>
    where
        T: UserSafe, // FIXME: should be implied by [T]: UserSafe?
    {
        unsafe { Iter((&*self.as_raw_ptr()).iter()) }
    }

    /// 返回允许修改每个值的迭代器。
    pub fn iter_mut(&mut self) -> IterMut<'_, T>
    where
        T: UserSafe, // FIXME: should be implied by [T]: UserSafe?
    {
        unsafe { IterMut((&mut *self.as_raw_mut_ptr()).iter_mut()) }
    }
}

/// 不可变的用户切片迭代器
///
/// This struct is created by the `iter` method on `UserRef<[T]>`.
#[unstable(feature = "sgx_platform", issue = "56975")]
pub struct Iter<'a, T: 'a + UserSafe>(slice::Iter<'a, T>);

#[unstable(feature = "sgx_platform", issue = "56975")]
impl<'a, T: UserSafe> Iterator for Iter<'a, T> {
    type Item = &'a UserRef<T>;

    #[inline]
    fn next(&mut self) -> Option<Self::Item> {
        unsafe { self.0.next().map(|e| UserRef::from_ptr(e)) }
    }
}

/// 可变的用户切片迭代器
///
/// This struct is created by the `iter_mut` method on `UserRef<[T]>`.
#[unstable(feature = "sgx_platform", issue = "56975")]
pub struct IterMut<'a, T: 'a + UserSafe>(slice::IterMut<'a, T>);

#[unstable(feature = "sgx_platform", issue = "56975")]
impl<'a, T: UserSafe> Iterator for IterMut<'a, T> {
    type Item = &'a mut UserRef<T>;

    #[inline]
    fn next(&mut self) -> Option<Self::Item> {
        unsafe { self.0.next().map(|e| UserRef::from_mut_ptr(e)) }
    }
}

#[unstable(feature = "sgx_platform", issue = "56975")]
impl<T: ?Sized> Deref for User<T>
where
    T: UserSafe,
{
    type Target = UserRef<T>;

    fn deref(&self) -> &Self::Target {
        unsafe { &*self.0.as_ptr() }
    }
}

#[unstable(feature = "sgx_platform", issue = "56975")]
impl<T: ?Sized> DerefMut for User<T>
where
    T: UserSafe,
{
    fn deref_mut(&mut self) -> &mut Self::Target {
        unsafe { &mut *self.0.as_ptr() }
    }
}

#[unstable(feature = "sgx_platform", issue = "56975")]
impl<T: ?Sized> Drop for User<T>
where
    T: UserSafe,
{
    fn drop(&mut self) {
        unsafe {
            let ptr = (*self.0.as_ptr()).0.get();
            super::free(ptr as _, size_of_val(&mut *ptr), T::align_of());
        }
    }
}

#[unstable(feature = "sgx_platform", issue = "56975")]
impl<T: CoerceUnsized<U>, U> CoerceUnsized<UserRef<U>> for UserRef<T> {}

#[unstable(feature = "sgx_platform", issue = "56975")]
impl<T, I> Index<I> for UserRef<[T]>
where
    [T]: UserSafe,
    I: SliceIndex<[T]>,
    I::Output: UserSafe,
{
    type Output = UserRef<I::Output>;

    #[inline]
    fn index(&self, index: I) -> &UserRef<I::Output> {
        unsafe {
            if let Some(slice) = index.get(&*self.as_raw_ptr()) {
                UserRef::from_ptr(slice)
            } else {
                rtabort!("index out of range for user slice");
            }
        }
    }
}

#[unstable(feature = "sgx_platform", issue = "56975")]
impl<T, I> IndexMut<I> for UserRef<[T]>
where
    [T]: UserSafe,
    I: SliceIndex<[T]>,
    I::Output: UserSafe,
{
    #[inline]
    fn index_mut(&mut self, index: I) -> &mut UserRef<I::Output> {
        unsafe {
            if let Some(slice) = index.get_mut(&mut *self.as_raw_mut_ptr()) {
                UserRef::from_mut_ptr(slice)
            } else {
                rtabort!("index out of range for user slice");
            }
        }
    }
}

#[unstable(feature = "sgx_platform", issue = "56975")]
impl UserRef<super::raw::ByteBuffer> {
    /// Copies the user memory range pointed to by the user `ByteBuffer` to
    /// 封装内存中。
    ///
    /// # Panics
    /// This function panics if, in the user `ByteBuffer`:
    ///
    /// * 指针为 null
    /// * 指向的范围无法适应地址空间
    /// * 指向的范围不在用户内存中
    pub fn copy_user_buffer(&self) -> Vec<u8> {
        unsafe {
            let buf = self.to_enclave();
            if buf.len > 0 {
                User::from_raw_parts(buf.data as _, buf.len).to_enclave()
            } else {
                // Mustn't look at `data` or call `free` if `len` is `0`.
                Vec::with_capacity(0)
            }
        }
    }
}
