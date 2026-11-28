//! 原子类型
//!
//! 原子类型提供了线程间共享的原始数据通信机制，是其他并发类型的核心构建块。
//! 这些类型都是并发类型的基石。
//! types.
//!
//! 等。
//! types, including [`AtomicBool`], [`AtomicIsize`], [`AtomicUsize`],
//! [`AtomicI8`], [`AtomicU16`], etc.
//! 线程间的更新。
//! updates between threads.
//!
//! Atomic variables are safe to share between threads (they implement [`Sync`])
//! Rust 的 [threading model]。
//! [threading model](../../../std/thread/index.html#the-threading-model) of Rust.
//! The most common way to share an atomic variable is to put it into an [`Arc`][arc] (an
//! atomically-reference-counted shared pointer).
//!
//! [arc]: ../../../std/sync/struct.Arc.html
//!
//! 通常用于延迟全局初始化。
//! the constant initializers like [`AtomicBool::new`]. Atomic statics
//! are often used for lazy global initialization.
//!
//! ## C++ 使用基于对象的内存模型，而 Rust 基于访问，因此需要在应用 C++ 规则到 Rust 时进行一些转换工作：每当 C++ 提到“对象的值”时，我们理解为读取时获得的字节数据。当 C++
//!
//! 标准提到“原子对象的值”时，指的是通过本模块提供的操作进行的原子加载结果。“对原子对象的修改”指的是原子存储。
//! from the [`intro.races`][cpp-intro.races] section, without the "consume" memory ordering. Since
//! C++ uses an object-based memory model whereas Rust is access-based, a bit of translation work
//! 这种模型最重要的特点是 *数据竞争* 是未定义行为。数据竞争
//! object", we understand that to mean the resulting bytes obtained when doing a read. When the C++
//! standard talks about "the value of an atomic object", this refers to the result of doing an
//! atomic load (via the operations provided in this module). A "modification of an atomic object"
//! refers to an atomic store.
//!
//! The end result is *almost* equivalent to saying that creating a *shared reference* to one of the
//! Rust atomic types corresponds to creating an `atomic_ref` in C++, with the `atomic_ref` being
//! destroyed when the lifetime of the shared reference ends. The main difference is that Rust
//! permits concurrent atomic and non-atomic reads to the same memory as those cause no issue in the
//! C++ memory model, they are just forbidden in C++ because memory is partitioned into "atomic
//! objects" and "non-atomic objects" (with `atomic_ref` temporarily converting a non-atomic object
//! into an atomic object).
//!
//! The most important aspect of this model is that *data races* are undefined behavior. A data race
//! 被定义为冲突的非同步访问，其中至少一种访问是
//! 非原子的。这里，如果访问影响内存的重叠区域，且
//! least one of them is a write. (A `compare_exchange` or `compare_exchange_weak` that does not
//! 如果两者都不是写操作，则不算写操作。）如果两者都不是
//! *前序*于对方，遵循内存模型的前序顺序。
//!
//! 内存模型中未定义行为的另一个可能原因是混合大小访问：Rust
//! 继承了 C++ 的限制，即非同步的冲突原子访问不能部分
//! 重叠。换句话说，每对非同步原子访问必须要么不重叠，
//! 访问完全相同的内存（包括使用相同的访问大小），要么都是读操作。
//!
//! Each atomic access takes an [`Ordering`] which defines how the operation interacts with the
//! 前序顺序的交互方式。这些顺序与相应的 [C++20 atomic
//! 顺序][cpp_memory_order] 相同。更多详情请参阅 [nomicon]。
//!
//! [cpp]: https://en.cppreference.com/w/cpp/atomic
//! [cpp-intro.races]: https://timsong-cpp.github.io/cppwp/n4868/intro.multithread#intro.races
//! [cpp_memory_order]: https://en.cppreference.com/w/cpp/atomic/memory_order
//! [nomicon]: ../../../nomicon/atomics.html
//!
//! ```rust,no_run undefined_behavior
//! use std::sync::atomic::{AtomicU16, AtomicU8, Ordering};
//! use std::mem::transmute;
//! use std::thread;
//!
//! let atomic = AtomicU16::new(0);
//!
//! thread::scope(|s| {
//!     // This is UB: conflicting non-synchronized accesses, at least one of which is non-atomic.
//!     s.spawn(|| atomic.store(1, Ordering::Relaxed)); // atomic store
//!     s.spawn(|| unsafe { atomic.as_ptr().write(2) }); // non-atomic write
//! });
//!
//! thread::scope(|s| {
//!     // This is fine: the accesses do not conflict (as none of them performs any modification).
//!     // In C++ this would be disallowed since creating an `atomic_ref` precludes
//!     // further non-atomic accesses, but Rust does not have that limitation.
//!     s.spawn(|| atomic.load(Ordering::Relaxed)); // atomic load
//!     s.spawn(|| unsafe { atomic.as_ptr().read() }); // non-atomic read
//! });
//!
//! thread::scope(|s| {
//!     // This is fine: `join` synchronizes the code in a way such that the atomic
//!     // store happens-before the non-atomic write.
//!     let handle = s.spawn(|| atomic.store(1, Ordering::Relaxed)); // atomic store
//!     handle.join().expect("thread won't panic"); // synchronize
//!     s.spawn(|| unsafe { atomic.as_ptr().write(2) }); // non-atomic write
//! });
//!
//! thread::scope(|s| {
//!     // This is UB: non-synchronized conflicting differently-sized atomic accesses.
//!     s.spawn(|| atomic.store(1, Ordering::Relaxed));
//!     s.spawn(|| unsafe {
//!         let differently_sized = transmute::<&AtomicU16, &AtomicU8>(&atomic);
//!         differently_sized.store(2, Ordering::Relaxed);
//!     });
//! });
//!
//! thread::scope(|s| {
//!     // This is fine: `join` synchronizes the code in a way such that
//!     // the 1-byte store happens-before the 2-byte store.
//!     let handle = s.spawn(|| atomic.store(1, Ordering::Relaxed));
//!     handle.join().expect("thread won't panic");
//!     s.spawn(|| unsafe {
//!         let differently_sized = transmute::<&AtomicU16, &AtomicU8>(&atomic);
//!         differently_sized.store(2, Ordering::Relaxed);
//!     });
//! });
//! ```
//!
//! # 可移植性
//!
//! 本模块中的所有原子类型如果可用，都保证是 [无锁] 的。这意味着它们内部不会获取全局互斥锁。原子
//! available. This means they don't internally acquire a global mutex. Atomic
//! 类型和操作不保证是无等待的。这意味着
//! operations like `fetch_or` may be implemented with a compare-and-swap loop.
//!
//! 原子操作可以在指令层使用
//! 更大尺寸的原子操作来实现。例如，某些平台使用 4 字节的原子
//! instructions to implement `AtomicI8`. Note that this emulation should not
//! 影响代码的正确性，只是需要注意的事项。
//!
//! 本模块中的原子类型可能并非所有平台都支持。这里的原子类型
//! 都广泛可用，通常可以依赖现有实现。一些显著的例外包括：
//! relied upon existing. Some notable exceptions are:
//!
//! * PowerPC and MIPS platforms with 32-bit pointers do not have `AtomicU64` or
//!   `AtomicI64` types.
//! * 如 ARMv4T 和 ARMv5TE 这样的旧版 ARM 平台，硬件对原子操作的支持非常有限。裸机目标完全禁用此模块，
//! 但 Linux 目标 [使用内核] 来辅助（这会带来性能开销）。直到 ARMv6K 以后，ARM CPU
//! entirely, but the Linux targets [use the kernel] to assist (which comes
//! with a performance penalty). It's not until ARMv6K onwards that ARM CPUs
//! 才在硬件上支持加载/存储和比较与交换 (CAS) 原子操作。
//! * ARMv6-M targets (`thumbv6m-*`) only provide `load` and `store` operations, and do
//!   not support Compare and Swap (CAS) operations, such as `swap`,
//!   `fetch_add`, etc. Full CAS support is available on ARMv7-M and ARMv8-M
//!   (`thumbv7m-*`, `thumbv7em*`, `thumbv8m.base-*` and `thumbv8m.main-*`).
//!
//! [use the kernel]: https://www.kernel.org/doc/Documentation/arm/kernel_user_helpers.txt
//!
//! Note that future platforms may be added that also do not have support for
//! some atomic operations. Maximally portable code will want to be careful
//! about which atomic types are used. `AtomicUsize` and `AtomicIsize` are
//! # 对只读内存的原子访问
//! For reference, the `std` library requires `AtomicBool`s and pointer-sized atomics, although
//! `core` does not.
//!
//! The `#[cfg(target_has_atomic)]` attribute can be used to conditionally
//! 出于本节的目的，“只读内存”定义为在底层目标中为只读的内存，即页面带有只读标志，任何写入尝试
//! option set for each supported size, with values "8", "16", "32", "64",
//! "128", and "ptr" for pointer-sized atomics.
//!
//! [lock-free]: https://en.wikipedia.org/wiki/Non-blocking_algorithm
//!
//! # 作为上述一般规则的例外，“足够小的”原子加载操作
//!
//! 通过一种适用于只读内存的方式实现，因此不属于未定义行为。使加载“足够小”的确切大小限制取决于目标：
//! to do a `compare_exchange` that will definitely fail (making it conceptually a read-only
//! operation) can still cause a segmentation fault if the underlying memory page is mapped read-only. Since
//! atomic `load`s might be implemented using compare-exchange operations, even a `load` can fault
//! on read-only memory.
//!
//! For the purpose of this section, "read-only memory" is defined as memory that is read-only in
//! the underlying target, i.e., the pages are mapped with a read-only flag and any attempt to write
//! will cause a page fault. In particular, an `&u128` reference that points to memory that is
//! read-write mapped is *not* considered to point to "read-only memory". In Rust, almost all memory
//! is read-write; the only exceptions are memory created by `const` items or `static` items without
//! interior mutability, and memory that was specifically marked as read-only by the operating
//! system via platform-specific APIs.
//!
//! As an exception from the general rule stated above, "sufficiently small" atomic loads with
//! `Ordering::Relaxed` are implemented in a way that works on read-only memory, and are hence not
//! undefined behavior. The exact size limit for what makes a load "sufficiently small" varies
//! depending on the target:
//!
//! | `target_arch` | Size limit |
//! |---------------|---------|
//! | `x86`, `arm`, `loongarch32`, `mips`, `mips32r6`, `powerpc`, `riscv32`, `sparc`, `hexagon` | 4 bytes |
//! | `x86_64`, `aarch64`, `loongarch64`, `mips64`, `mips64r6`, `powerpc64`, `riscv64`, `sparc64`, `s390x` | 8 bytes |
//!
//! 大于此限制的原子加载操作，以及具有排序要求的原子加载操作
//! than `Relaxed`, as well as *all* atomic loads on targets not listed in the table, might still be
//! 在某些条件下可能为只读，但这并非稳定保证，不应依赖此情况。
//! 如果需要在只读内存上进行获取加载操作，可以先进行宽松加载，然后执行获取围栏操作。
//!
//! # 示例
//! acquire fence instead.
//!
//! # Examples
//!
//! 一个简单的自旋锁：
//!
//! ```ignore-wasm
//! use std::sync::Arc;
//! use std::sync::atomic::{AtomicUsize, Ordering};
//! use std::{hint, thread};
//!
//! fn main() {
//!     let spinlock = Arc::new(AtomicUsize::new(1));
//!
//!     let spinlock_clone = Arc::clone(&spinlock);
//!
//!     let thread = thread::spawn(move || {
//!         spinlock_clone.store(0, Ordering::Release);
//!     });
//!
//!     // Wait for the other thread to release the lock
//!     while spinlock.load(Ordering::Acquire) != 0 {
//!         hint::spin_loop();
//!     }
//!
//!     if let Err(panic) = thread.join() {
//!         println!("Thread had an error: {panic:?}");
//!     }
//! }
//! ```
//!
//! 维护一个全局活线程计数：
//!
//! ```
//! use std::sync::atomic::{AtomicUsize, Ordering};
//!
//! static GLOBAL_THREAD_COUNT: AtomicUsize = AtomicUsize::new(0);
//!
//! // Note that Relaxed ordering doesn't synchronize anything
//! // except the global thread counter itself.
//! let old_thread_count = GLOBAL_THREAD_COUNT.fetch_add(1, Ordering::Relaxed);
//! // Note that this number may not be true at the moment of printing
//! // because some other thread may have changed static value already.
//! println!("live threads: {}", old_thread_count + 1);
//! ```

#![stable(feature = "rust1", since = "1.0.0")]
#![cfg_attr(not(target_has_atomic_load_store = "8"), allow(dead_code))]
#![cfg_attr(not(target_has_atomic_load_store = "8"), allow(unused_imports))]
// Clippy complains about the pattern of "safe function calling unsafe function taking pointers".
// This happens with AtomicPtr intrinsics but is fine, as the pointers clippy is concerned about
// are just normal values that get loaded/stored, but not dereferenced.
#![allow(clippy::not_unsafe_ptr_arg_deref)]

use self::Ordering::*;
use crate::cell::UnsafeCell;
use crate::hint::spin_loop;
use crate::intrinsics::AtomicOrdering as AO;
use crate::mem::transmute;
use crate::{fmt, intrinsics};

#[unstable(
    feature = "atomic_internals",
    reason = "implementation detail which may disappear or be replaced at any time",
    issue = "none"
)]
#[expect(missing_debug_implementations)]
mod private {
    #[cfg(target_has_atomic_load_store = "8")]
    #[repr(C, align(1))]
    pub struct Align1<T>(T);
    #[cfg(target_has_atomic_load_store = "16")]
    #[repr(C, align(2))]
    pub struct Align2<T>(T);
    #[cfg(target_has_atomic_load_store = "32")]
    #[repr(C, align(4))]
    pub struct Align4<T>(T);
    #[cfg(target_has_atomic_load_store = "64")]
    #[repr(C, align(8))]
    pub struct Align8<T>(T);
    #[cfg(any(target_has_atomic_load_store = "128", doc))]
    #[repr(C, align(16))]
    pub struct Align16<T>(T);
}

/// 用于原始类型的标记 trait，可以原子地修改。
///
/// This is an implementation detail for <code>[Atomic]\<T></code> which may disappear or be replaced at any time.
//
// # Safety
//
// Types implementing this trait must be primitives that can be modified atomically.
//
// The associated `Self::Storage` type must have the same size, but may have fewer validity
// invariants or a higher alignment requirement than `Self`.
#[unstable(
    feature = "atomic_internals",
    reason = "implementation detail which may disappear or be replaced at any time",
    issue = "none"
)]
pub impl(self) unsafe trait AtomicPrimitive: Sized + Copy {
    /// 临时实现细节。
    type Storage: Sized;
}

macro impl_atomic_primitive {
    (
        @impl [$($T:ident)?] $Primitive:ty as $Storage:ident<$Operand:ty>,
        $cfg:meta
    ) => {
        #[unstable(
            feature = "atomic_internals",
            reason = "implementation detail which may disappear or be replaced at any time",
            issue = "none"
        )]
        #[cfg($cfg)]
        unsafe impl $(<$T>)? AtomicPrimitive for $Primitive {
            type Storage = private::$Storage<$Operand>;
        }
    },

    (
        [$($T:ident)?] $Primitive:ty as $Storage:ident<$Operand:ty>,
        size($size:literal)
    ) => {
        impl_atomic_primitive!(
            @impl [$($T)?] $Primitive as $Storage<$Operand>,
            target_has_atomic_load_store = $size
        );
    },

    (
        [$($T:ident)?] $Primitive:ty as $Storage:ident<$Operand:ty>,
        size($size:literal),
        doc
    ) => {
        impl_atomic_primitive!(
            @impl [$($T)?] $Primitive as $Storage<$Operand>,
            any(target_has_atomic_load_store = $size, doc)
        );
    },
}

impl_atomic_primitive!([] bool as Align1<u8>, size("8"));
impl_atomic_primitive!([] i8 as Align1<i8>, size("8"));
impl_atomic_primitive!([] u8 as Align1<u8>, size("8"));
impl_atomic_primitive!([] i16 as Align2<i16>, size("16"));
impl_atomic_primitive!([] u16 as Align2<u16>, size("16"));
impl_atomic_primitive!([] i32 as Align4<i32>, size("32"));
impl_atomic_primitive!([] u32 as Align4<u32>, size("32"));
impl_atomic_primitive!([] i64 as Align8<i64>, size("64"));
impl_atomic_primitive!([] u64 as Align8<u64>, size("64"));
impl_atomic_primitive!([] i128 as Align16<i128>, size("128"), doc);
impl_atomic_primitive!([] u128 as Align16<u128>, size("128"), doc);

#[cfg(target_pointer_width = "16")]
impl_atomic_primitive!([] isize as Align2<isize>, size("ptr"));
#[cfg(target_pointer_width = "32")]
impl_atomic_primitive!([] isize as Align4<isize>, size("ptr"));
#[cfg(target_pointer_width = "64")]
impl_atomic_primitive!([] isize as Align8<isize>, size("ptr"));

#[cfg(target_pointer_width = "16")]
impl_atomic_primitive!([] usize as Align2<usize>, size("ptr"));
#[cfg(target_pointer_width = "32")]
impl_atomic_primitive!([] usize as Align4<usize>, size("ptr"));
#[cfg(target_pointer_width = "64")]
impl_atomic_primitive!([] usize as Align8<usize>, size("ptr"));

#[cfg(target_pointer_width = "16")]
impl_atomic_primitive!([T] *mut T as Align2<*mut T>, size("ptr"));
#[cfg(target_pointer_width = "32")]
impl_atomic_primitive!([T] *mut T as Align4<*mut T>, size("ptr"));
#[cfg(target_pointer_width = "64")]
impl_atomic_primitive!([T] *mut T as Align8<*mut T>, size("ptr"));

/// 一个可以从多个线程安全修改的内存位置。
///
/// This has the same size and bit validity as the underlying type `T`. However,
/// the alignment of this type is always equal to its size, even on targets where
/// `T` has alignment less than its size.
///
/// [模块级文档]。
/// well as information about the portability of this type, please see the
/// [module-level documentation].
///
/// **Note:** This type is only available on platforms that support atomic loads
/// and stores of `T`.
///
/// [module-level documentation]: crate::sync::atomic
#[unstable(feature = "generic_atomic", issue = "130539")]
#[repr(C)]
#[rustc_diagnostic_item = "Atomic"]
pub struct Atomic<T: AtomicPrimitive> {
    v: UnsafeCell<T::Storage>,
}

#[stable(feature = "rust1", since = "1.0.0")]
unsafe impl<T: AtomicPrimitive> Send for Atomic<T> {}
#[stable(feature = "rust1", since = "1.0.0")]
unsafe impl<T: AtomicPrimitive> Sync for Atomic<T> {}

// Some architectures don't have byte-sized atomics, which results in LLVM
// emulating them using a LL/SC loop. However for AtomicBool we can take
// advantage of the fact that it only ever contains 0 or 1 and use atomic OR/AND
// instead, which LLVM can emulate using a larger atomic OR/AND operation.
//
// This list should only contain architectures which have word-sized atomic-or/
// atomic-and instructions but don't natively support byte-sized atomics.
#[cfg(target_has_atomic = "8")]
const EMULATE_ATOMIC_BOOL: bool = cfg!(any(
    target_arch = "riscv32",
    target_arch = "riscv64",
    target_arch = "loongarch32",
    target_arch = "loongarch64"
));

/// A boolean type which can be safely shared between threads.
///
/// This type has the same size, alignment, and bit validity as a [`bool`].
///
/// **Note**: This type is only available on platforms that support atomic
/// loads and stores of `u8`.
#[cfg(target_has_atomic_load_store = "8")]
#[stable(feature = "rust1", since = "1.0.0")]
pub type AtomicBool = Atomic<bool>;

#[cfg(target_has_atomic_load_store = "8")]
#[stable(feature = "rust1", since = "1.0.0")]
impl Default for AtomicBool {
    /// Creates an `AtomicBool` initialized to `false`.
    #[inline]
    fn default() -> Self {
        Self::new(false)
    }
}

/// 一种可以在多个线程之间安全共享的原始指针类型。
///
/// This type has the same size and bit validity as a `*mut T`.
///
/// **Note**: This type is only available on platforms that support atomic
/// loads and stores of pointers. Its size depends on the target pointer's size.
#[cfg(target_has_atomic_load_store = "ptr")]
#[stable(feature = "rust1", since = "1.0.0")]
pub type AtomicPtr<T> = Atomic<*mut T>;

#[cfg(target_has_atomic_load_store = "ptr")]
#[stable(feature = "rust1", since = "1.0.0")]
impl<T> Default for AtomicPtr<T> {
    /// Creates a null `AtomicPtr<T>`.
    fn default() -> AtomicPtr<T> {
        AtomicPtr::new(crate::ptr::null_mut())
    }
}

/// 内存排序指定了原子操作如何同步内存。
///
/// 内存排序规定了原子操作同步内存的方式。
/// In its weakest [`Ordering::Relaxed`], only the memory directly touched by the
/// operation is synchronized. On the other hand, a store-load pair of [`Ordering::SeqCst`]
/// 在保持整体顺序的同时同步其他内存操作。
/// 所有线程之间的操作同步。
///
/// Rust 的内存顺序与[nomicon]中的相同。
/// C++20](https://en.cppreference.com/w/cpp/atomic/memory_order).
///
/// 更多详情请参见 [nomicon]。
///
/// [nomicon]: ../../../nomicon/atomics.html
#[stable(feature = "rust1", since = "1.0.0")]
#[derive(Copy, Clone, Debug, Eq, PartialEq, Hash)]
#[non_exhaustive]
#[rustc_diagnostic_item = "Ordering"]
pub enum Ordering {
    /// 没有排序约束，仅支持原子操作。
    ///
    /// Corresponds to [`memory_order_relaxed`] in C++20.
    ///
    /// [`memory_order_relaxed`]: https://en.cppreference.com/w/cpp/atomic/memory_order#Relaxed_ordering
    #[stable(feature = "rust1", since = "1.0.0")]
    Relaxed,
    /// When coupled with a store, all previous operations become ordered
    /// before any load of this value with [`Acquire`] (or stronger) ordering.
    /// In particular, all previous writes become visible to all threads
    /// that perform an [`Acquire`] (or stronger) load of this value.
    ///
    /// Notice that using this ordering for an operation that combines loads
    /// and stores leads to a [`Relaxed`] load operation!
    ///
    /// This ordering is only applicable for operations that can perform a store.
    ///
    /// Corresponds to [`memory_order_release`] in C++20.
    ///
    /// [`memory_order_release`]: https://en.cppreference.com/w/cpp/atomic/memory_order#Release-Acquire_ordering
    #[stable(feature = "rust1", since = "1.0.0")]
    Release,
    /// When coupled with a load, if the loaded value was written by a store operation with
    /// [`Release`] (or stronger) ordering, then all subsequent operations
    /// 这种顺序仅适用于可以执行加载操作的操作。
    /// written before the store.
    ///
    /// Notice that using this ordering for an operation that combines loads
    /// and stores leads to a [`Relaxed`] store operation!
    ///
    /// This ordering is only applicable for operations that can perform a load.
    ///
    /// Corresponds to [`memory_order_acquire`] in C++20.
    ///
    /// [`memory_order_acquire`]: https://en.cppreference.com/w/cpp/atomic/memory_order#Release-Acquire_ordering
    #[stable(feature = "rust1", since = "1.0.0")]
    Acquire,
    /// Has the effects of both [`Acquire`] and [`Release`] together:
    /// For loads it uses [`Acquire`] ordering. For stores it uses the [`Release`] ordering.
    ///
    /// Notice that in the case of `compare_and_swap`, it is possible that the operation ends up
    /// not performing any store and hence it has just [`Acquire`] ordering. However,
    /// `AcqRel` will never perform [`Relaxed`] accesses.
    ///
    /// This ordering is only applicable for operations that combine both loads and stores.
    ///
    /// Corresponds to [`memory_order_acq_rel`] in C++20.
    ///
    /// [`memory_order_acq_rel`]: https://en.cppreference.com/w/cpp/atomic/memory_order#Release-Acquire_ordering
    #[stable(feature = "rust1", since = "1.0.0")]
    AcqRel,
    /// Like [`Acquire`]/[`Release`]/[`AcqRel`] (for load, store, and load-with-store
    /// operations, respectively) with the additional guarantee that all threads see all
    /// # 示例
    ///
    /// Corresponds to [`memory_order_seq_cst`] in C++20.
    ///
    /// [`memory_order_seq_cst`]: https://en.cppreference.com/w/cpp/atomic/memory_order#Sequentially-consistent_ordering
    #[stable(feature = "rust1", since = "1.0.0")]
    SeqCst,
}

/// An [`AtomicBool`] initialized to `false`.
#[cfg(target_has_atomic_load_store = "8")]
#[stable(feature = "rust1", since = "1.0.0")]
#[deprecated(
    since = "1.34.0",
    note = "the `new` function is now preferred",
    suggestion = "AtomicBool::new(false)"
)]
#[expect(clippy::declare_interior_mutable_const, reason = "legacy atomic initializer")]
pub const ATOMIC_BOOL_INIT: AtomicBool = AtomicBool::new(false);

#[cfg(target_has_atomic_load_store = "8")]
impl AtomicBool {
    /// Creates a new `AtomicBool`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::atomic::AtomicBool;
    ///
    /// let atomic_true = AtomicBool::new(true);
    /// let atomic_false = AtomicBool::new(false);
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_atomic_new", since = "1.24.0")]
    #[must_use]
    pub const fn new(v: bool) -> AtomicBool {
        // SAFETY:
        // `Atomic<T>` is essentially a transparent wrapper around `T`.
        unsafe { transmute(v) }
    }

    /// Creates a new `AtomicBool` from a pointer.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::atomic::{self, AtomicBool};
    ///
    /// // Get a pointer to an allocated value
    /// let ptr: *mut bool = Box::into_raw(Box::new(false));
    ///
    /// assert!(ptr.cast::<AtomicBool>().is_aligned());
    ///
    /// {
    ///     // Create an atomic view of the allocated value
    ///     let atomic = unsafe { AtomicBool::from_ptr(ptr) };
    ///
    ///     // Use `atomic` for atomic operations, possibly share it with other threads
    ///     atomic.store(true, atomic::Ordering::Relaxed);
    /// }
    ///
    /// // It's ok to non-atomically access the value behind `ptr`,
    /// // since the reference to the atomic ended its lifetime in the block above
    /// assert_eq!(unsafe { *ptr }, true);
    ///
    /// // Deallocate the value
    /// unsafe { drop(Box::from_raw(ptr)) }
    /// ```
    ///
    /// # 安全性
    ///
    /// * `ptr` must be aligned to `align_of::<AtomicBool>()` (note that this is always true, since
    ///   `align_of::<AtomicBool>() == 1`).
    /// * `ptr` must be [valid] for both reads and writes for the whole lifetime `'a`.
    /// * 你必须遵循[原子访问的内存模型]。特别是，不允许混合冲突的原子与非原子访问，或不同
    /// 大小的原子访问，而不进行同步。
    ///   sizes, without synchronization.
    ///
    /// [valid]: crate::ptr#safety
    /// [Memory model for atomic accesses]: self#memory-model-for-atomic-accesses
    #[inline]
    #[stable(feature = "atomic_from_ptr", since = "1.75.0")]
    #[rustc_const_stable(feature = "const_atomic_from_ptr", since = "1.84.0")]
    pub const unsafe fn from_ptr<'a>(ptr: *mut bool) -> &'a AtomicBool {
        // SAFETY: guaranteed by the caller
        unsafe { &*ptr.cast() }
    }

    /// Creates a new pointer to `AtomicBool` from a pointer.
    ///
    /// 如果你需要进行易失性原子访问，从而避免创建
    /// 对目标引用的引用，这很有用。
    #[inline]
    #[unstable(feature = "atomic_volatile", issue = "158947")]
    pub const fn from_ptr_raw(ptr: *mut bool) -> *const AtomicBool {
        ptr.cast_const().cast()
    }

    /// Returns a mutable reference to the underlying [`bool`].
    ///
    /// 这是安全的，因为可变引用保证没有其他线程
    /// 同时访问原子数据。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::atomic::{AtomicBool, Ordering};
    ///
    /// let mut some_bool = AtomicBool::new(true);
    /// assert_eq!(*some_bool.get_mut(), true);
    /// *some_bool.get_mut() = false;
    /// assert_eq!(some_bool.load(Ordering::SeqCst), false);
    /// ```
    #[inline]
    #[stable(feature = "atomic_access", since = "1.15.0")]
    #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
    pub const fn get_mut(&mut self) -> &mut bool {
        // SAFETY: the mutable reference guarantees unique ownership.
        unsafe { &mut *self.as_ptr() }
    }

    /// Gets atomic access to a `&mut bool`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::atomic::{AtomicBool, Ordering};
    ///
    /// let mut some_bool = true;
    /// let a = AtomicBool::from_mut(&mut some_bool);
    /// a.store(false, Ordering::Relaxed);
    /// assert_eq!(some_bool, false);
    /// ```
    #[inline]
    #[cfg(target_has_atomic_primitive_alignment = "8")]
    #[stable(feature = "atomic_from_mut", since = "1.98.0")]
    #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
    pub const fn from_mut(v: &mut bool) -> &mut Self {
        // SAFETY: the mutable reference guarantees unique ownership, and
        // alignment of both `bool` and `Self` is 1.
        unsafe { &mut *(v as *mut bool as *mut Self) }
    }

    /// Gets non-atomic access to a `&mut [AtomicBool]` slice.
    ///
    /// 这是安全的，因为可变引用保证没有其他线程
    /// 同时访问原子数据。
    ///
    /// # 示例
    ///
    /// ```ignore-wasm
    /// use std::sync::atomic::{AtomicBool, Ordering};
    ///
    /// let mut some_bools = [const { AtomicBool::new(false) }; 10];
    ///
    /// let view: &mut [bool] = AtomicBool::get_mut_slice(&mut some_bools);
    /// assert_eq!(view, [false; 10]);
    /// view[..5].copy_from_slice(&[true; 5]);
    ///
    /// std::thread::scope(|s| {
    ///     for t in &some_bools[..5] {
    ///         s.spawn(move || assert_eq!(t.load(Ordering::Relaxed), true));
    ///     }
    ///
    ///     for f in &some_bools[5..] {
    ///         s.spawn(move || assert_eq!(f.load(Ordering::Relaxed), false));
    ///     }
    /// });
    /// ```
    #[inline]
    #[stable(feature = "atomic_from_mut", since = "1.98.0")]
    #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
    pub const fn get_mut_slice(this: &mut [Self]) -> &mut [bool] {
        // SAFETY: the mutable reference guarantees unique ownership.
        unsafe { &mut *(this as *mut [Self] as *mut [bool]) }
    }

    /// Gets atomic access to a `&mut [bool]` slice.
    ///
    /// # 示例
    ///
    /// ```rust,ignore-wasm
    /// use std::sync::atomic::{AtomicBool, Ordering};
    ///
    /// let mut some_bools = [false; 10];
    /// let a = &*AtomicBool::from_mut_slice(&mut some_bools);
    /// std::thread::scope(|s| {
    ///     for i in 0..a.len() {
    ///         s.spawn(move || a[i].store(true, Ordering::Relaxed));
    ///     }
    /// });
    /// assert_eq!(some_bools, [true; 10]);
    /// ```
    #[inline]
    #[cfg(target_has_atomic_primitive_alignment = "8")]
    #[stable(feature = "atomic_from_mut", since = "1.98.0")]
    #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
    pub const fn from_mut_slice(v: &mut [bool]) -> &mut [Self] {
        // SAFETY: the mutable reference guarantees unique ownership, and
        // alignment of both `bool` and `Self` is 1.
        unsafe { &mut *(v as *mut [bool] as *mut [Self]) }
    }

    /// 消耗原子数据并返回所包含的值。
    ///
    /// This is safe because passing `self` by value guarantees that no other threads are
    /// 同时访问原子数据。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::atomic::AtomicBool;
    ///
    /// let some_bool = AtomicBool::new(true);
    /// assert_eq!(some_bool.into_inner(), true);
    /// ```
    #[inline]
    #[stable(feature = "atomic_access", since = "1.15.0")]
    #[rustc_const_stable(feature = "const_atomic_into_inner", since = "1.79.0")]
    pub const fn into_inner(self) -> bool {
        // SAFETY:
        // * `Atomic<T>` is essentially a transparent wrapper around `T`.
        // * all operations on `Atomic<bool>` ensure that `T::Storage` remains
        //   a valid `bool`.
        unsafe { transmute(self) }
    }

    /// 从 bool 加载一个值。
    ///
    /// `load` takes an [`Ordering`] argument which describes the memory ordering
    /// of this operation. Possible values are [`SeqCst`], [`Acquire`] and [`Relaxed`].
    ///
    /// # Panics
    ///
    /// Panics if `order` is [`Release`] or [`AcqRel`].
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::atomic::{AtomicBool, Ordering};
    ///
    /// let some_bool = AtomicBool::new(true);
    ///
    /// assert_eq!(some_bool.load(Ordering::Relaxed), true);
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    pub const fn load(&self, order: Ordering) -> bool {
        // SAFETY: any data races are prevented by atomic intrinsics and the raw
        // pointer passed in is valid because we got it from a reference.
        unsafe {
            atomic_load::<_, /* VOLATILE */ false>(self.v.get().cast::<u8>(), order) != 0
        }
    }

    /// 从 bool 执行易失性原子加载。
    ///
    /// `load_volatile` takes an [`Ordering`] argument which describes the memory ordering
    /// of this operation. Possible values are [`SeqCst`], [`Acquire`] and [`Relaxed`].
    ///
    #[doc = include_str!("./atomic_load_volatile.md")]
    ///
    /// # 安全性
    ///
    /// 如果违反以下任何条件，行为未定义：
    ///
    /// * `self` must be [valid] for reads, or `self` must point to memory
    /// - 不引发 panic，并且
    /// - not trap, and
    /// - 不修改 Rust 分配内的任何内存。
    ///
    /// * Reading from `self` must produce a properly initialized value of type `bool`.
    ///
    /// [valid]: core::ptr#safety
    ///
    /// # Panics
    ///
    /// Panics if `order` is [`Release`] or [`AcqRel`].
    #[inline]
    #[unstable(feature = "atomic_volatile", issue = "158947")]
    #[rustc_const_unstable(feature = "atomic_volatile", issue = "158947")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    pub const unsafe fn load_volatile(self: *const Self, order: Ordering) -> bool {
        // SAFETY: follows from our own safety requirements.
        unsafe {
            atomic_load::<_, /* VOLATILE */ true>(self.cast::<u8>(), order) != 0
        }
    }

    /// 将值存储到 bool 中。
    ///
    /// `store` takes an [`Ordering`] argument which describes the memory ordering
    /// of this operation. Possible values are [`SeqCst`], [`Release`] and [`Relaxed`].
    ///
    /// # Panics
    ///
    /// Panics if `order` is [`Acquire`] or [`AcqRel`].
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::atomic::{AtomicBool, Ordering};
    ///
    /// let some_bool = AtomicBool::new(true);
    ///
    /// some_bool.store(false, Ordering::Relaxed);
    /// assert_eq!(some_bool.load(Ordering::Relaxed), false);
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub const fn store(&self, val: bool, order: Ordering) {
        // SAFETY: any data races are prevented by atomic intrinsics and the raw
        // pointer passed in is valid because we got it from a reference.
        unsafe {
            atomic_store::<_, /* VOLATILE */ false>(self.v.get().cast::<u8>(), val as u8, order);
        }
    }

    /// 执行易失性原子存储到 bool 中。
    ///
    /// `store_volatile` takes an [`Ordering`] argument which describes the memory ordering
    /// of this operation. Possible values are [`SeqCst`], [`Release`] and [`Relaxed`].
    ///
    #[doc = include_str!("./atomic_store_volatile.md")]
    ///
    /// # 安全性
    ///
    /// 如果违反以下任一条件，行为将未定义：
    ///
    /// * `self` must be either [valid] for writes, or `self` must point to memory
    /// 在所有的 Rust 分配之外，对该内存的写入必须：
    /// - 不引发 panic，并且
    /// - 不会修改 Rust 分配内的任何内存。
    ///
    /// [valid]: core::ptr#safety
    ///
    /// # Panic
    ///
    /// Panics if `order` is [`Acquire`] or [`AcqRel`].
    #[inline]
    #[unstable(feature = "atomic_volatile", issue = "158947")]
    #[rustc_const_unstable(feature = "atomic_volatile", issue = "158947")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub const unsafe fn store_volatile(self: *const Self, val: bool, order: Ordering) {
        // SAFETY: follows from our own safety requirements.
        unsafe {
            atomic_store::<_, /* VOLATILE */ true>(self.cast::<u8>().cast_mut(), val as u8, order);
        }
    }

    /// 将值存储到 bool 中，并返回之前的值。
    ///
    /// `swap` takes an [`Ordering`] argument which describes the memory ordering
    /// of this operation. All ordering modes are possible. Note that using
    /// [`Acquire`] makes the store part of this operation [`Relaxed`], and
    /// using [`Release`] makes the load part [`Relaxed`].
    ///
    /// **Note:** This method is only available on platforms that support atomic
    /// operations on `u8`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::atomic::{AtomicBool, Ordering};
    ///
    /// let some_bool = AtomicBool::new(true);
    ///
    /// assert_eq!(some_bool.swap(false, Ordering::Relaxed), true);
    /// assert_eq!(some_bool.load(Ordering::Relaxed), false);
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
    #[cfg(target_has_atomic = "8")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub const fn swap(&self, val: bool, order: Ordering) -> bool {
        if EMULATE_ATOMIC_BOOL {
            if val { self.fetch_or(true, order) } else { self.fetch_and(false, order) }
        } else {
            // SAFETY: data races are prevented by atomic intrinsics.
            unsafe { atomic_swap(self.v.get().cast::<u8>(), val as u8, order) != 0 }
        }
    }

    /// Stores a value into the [`bool`] if the current value is the same as the `current` value.
    ///
    /// The return value is always the previous value. If it is equal to `current`, then the value
    /// was updated.
    ///
    /// `compare_and_swap` also takes an [`Ordering`] argument which describes the memory
    /// ordering of this operation. Notice that even when using [`AcqRel`], the operation
    /// might fail and hence just perform an `Acquire` load, but not have `Release` semantics.
    /// Using [`Acquire`] makes the store part of this operation [`Relaxed`] if it
    /// happens, and using [`Release`] makes the load part [`Relaxed`].
    ///
    /// 内存顺序：
    /// operations on `u8`.
    ///
    /// # Migrating to `compare_exchange` and `compare_exchange_weak`
    ///
    /// `compare_and_swap` is equivalent to `compare_exchange` with the following mapping for
    /// 释放  | 释放  | 宽松
    ///
    /// AcqRel | AcqRel | 获取
    /// -------- | ------- | -------
    /// SeqCst | SeqCst | SeqCst
    /// Acquire  | Acquire | Acquire
    /// Release  | Release | Relaxed
    /// AcqRel   | AcqRel  | Acquire
    /// 比根据读取的值推断成功或失败更符合惯例。
    ///
    /// `compare_and_swap` and `compare_exchange` also differ in their return type. You can use
    /// `compare_exchange(...).unwrap_or_else(|x| x)` to recover the behavior of `compare_and_swap`,
    /// but in most cases it is more idiomatic to check whether the return value is `Ok` or `Err`
    /// rather than to infer success vs failure based on the value that was read.
    ///
    /// During migration, consider whether it makes sense to use `compare_exchange_weak` instead.
    /// `compare_exchange_weak` is allowed to fail spuriously even when the comparison succeeds,
    /// 这使得编译器在进行比较和交换时能够生成更优质的汇编代码。
    /// 用于循环中。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::atomic::{AtomicBool, Ordering};
    ///
    /// let some_bool = AtomicBool::new(true);
    ///
    /// assert_eq!(some_bool.compare_and_swap(true, false, Ordering::Relaxed), true);
    /// assert_eq!(some_bool.load(Ordering::Relaxed), false);
    ///
    /// assert_eq!(some_bool.compare_and_swap(true, true, Ordering::Relaxed), false);
    /// assert_eq!(some_bool.load(Ordering::Relaxed), false);
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
    #[deprecated(
        since = "1.50.0",
        note = "Use `compare_exchange` or `compare_exchange_weak` instead"
    )]
    #[cfg(target_has_atomic = "8")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub const fn compare_and_swap(&self, current: bool, new: bool, order: Ordering) -> bool {
        match self.compare_exchange(current, new, order, strongest_failure_ordering(order)) {
            Ok(x) => x,
            Err(x) => x,
        }
    }

    /// Stores a value into the [`bool`] if the current value is the same as the `current` value.
    ///
    /// 返回值是一个结果，表示新值是否已被写入，并包含
    /// the previous value. On success this value is guaranteed to be equal to `current`.
    ///
    /// `compare_exchange` takes two [`Ordering`] arguments to describe the memory
    /// ordering of this operation. `success` describes the required ordering for the
    /// read-modify-write operation that takes place if the comparison with `current` succeeds.
    /// `failure` describes the required ordering for the load operation that takes place when
    /// the comparison fails. Using [`Acquire`] as success ordering makes the store part
    /// of this operation [`Relaxed`], and using [`Release`] makes the successful load
    /// [`Relaxed`]. The failure ordering can only be [`SeqCst`], [`Acquire`] or [`Relaxed`].
    ///
    /// **注意：** 该方法仅在支持原子
    /// operations on `u8`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::atomic::{AtomicBool, Ordering};
    ///
    /// let some_bool = AtomicBool::new(true);
    ///
    /// assert_eq!(some_bool.compare_exchange(true,
    ///                                       false,
    ///                                       Ordering::Acquire,
    ///                                       Ordering::Relaxed),
    ///            Ok(true));
    /// assert_eq!(some_bool.load(Ordering::Relaxed), false);
    ///
    /// assert_eq!(some_bool.compare_exchange(true, true,
    ///                                       Ordering::SeqCst,
    ///                                       Ordering::Acquire),
    ///            Err(false));
    /// assert_eq!(some_bool.load(Ordering::Relaxed), false);
    /// ```
    ///
    /// # 注意事项
    ///
    /// `compare_exchange` is a [compare-and-swap operation] and thus exhibits the usual downsides
    /// of CAS operations. In particular, a load of the value followed by a successful
    /// `compare_exchange` with the previous load *does not ensure* that other threads have not
    /// changed the value in the interim. This is usually important when the *equality* check in
    /// the `compare_exchange` is being used to check the *identity* of a value, but equality
    /// does not necessarily imply identity. In this case, `compare_exchange` can lead to the
    /// [ABA problem].
    ///
    /// [ABA Problem]: https://en.wikipedia.org/wiki/ABA_problem
    /// [compare-and-swap operation]: https://en.wikipedia.org/wiki/Compare-and-swap
    #[inline]
    #[stable(feature = "extended_compare_and_swap", since = "1.10.0")]
    #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
    #[doc(alias = "compare_and_swap")]
    #[cfg(target_has_atomic = "8")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub const fn compare_exchange(
        &self,
        current: bool,
        new: bool,
        success: Ordering,
        failure: Ordering,
    ) -> Result<bool, bool> {
        if EMULATE_ATOMIC_BOOL {
            // Pick the strongest ordering from success and failure.
            let order = match (success, failure) {
                (SeqCst, _) => SeqCst,
                (_, SeqCst) => SeqCst,
                (AcqRel, _) => AcqRel,
                (_, AcqRel) => {
                    panic!("there is no such thing as an acquire-release failure ordering")
                }
                (Release, Acquire) => AcqRel,
                (Acquire, _) => Acquire,
                (_, Acquire) => Acquire,
                (Release, Relaxed) => Release,
                (_, Release) => panic!("there is no such thing as a release failure ordering"),
                (Relaxed, Relaxed) => Relaxed,
            };
            let old = if current == new {
                // This is a no-op, but we still need to perform the operation
                // for memory ordering reasons.
                self.fetch_or(false, order)
            } else {
                // This sets the value to the new one and returns the old one.
                self.swap(new, order)
            };
            if old == current { Ok(old) } else { Err(old) }
        } else {
            // SAFETY: data races are prevented by atomic intrinsics.
            match unsafe {
                atomic_compare_exchange(
                    self.v.get().cast::<u8>(),
                    current as u8,
                    new as u8,
                    success,
                    failure,
                )
            } {
                Ok(x) => Ok(x != 0),
                Err(x) => Err(x != 0),
            }
        }
    }

    /// Stores a value into the [`bool`] if the current value is the same as the `current` value.
    ///
    /// Unlike [`AtomicBool::compare_exchange`], this function is allowed to spuriously fail even when the
    /// 之前的值。
    /// return value is a result indicating whether the new value was written and containing the
    /// previous value.
    ///
    /// `compare_exchange_weak` takes two [`Ordering`] arguments to describe the memory
    /// ordering of this operation. `success` describes the required ordering for the
    /// read-modify-write operation that takes place if the comparison with `current` succeeds.
    /// `failure` describes the required ordering for the load operation that takes place when
    /// the comparison fails. Using [`Acquire`] as success ordering makes the store part
    /// of this operation [`Relaxed`], and using [`Release`] makes the successful load
    /// [`Relaxed`]. The failure ordering can only be [`SeqCst`], [`Acquire`] or [`Relaxed`].
    ///
    /// **注意：** 该方法仅在支持原子操作的平台上可用。
    /// operations on `u8`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::atomic::{AtomicBool, Ordering};
    ///
    /// let val = AtomicBool::new(false);
    ///
    /// let new = true;
    /// let mut old = val.load(Ordering::Relaxed);
    /// loop {
    ///     match val.compare_exchange_weak(old, new, Ordering::SeqCst, Ordering::Relaxed) {
    ///         Ok(_) => break,
    ///         Err(x) => old = x,
    ///     }
    /// }
    /// ```
    ///
    /// # 考虑因素
    ///
    /// `compare_exchange` is a [compare-and-swap operation] and thus exhibits the usual downsides
    /// 对上一次加载值的操作 *并不保证* 其他线程在期间没有改变该值。当在
    /// `compare_exchange` with the previous load *does not ensure* that other threads have not
    /// changed the value in the interim. This is usually important when the *equality* check in
    /// the `compare_exchange` is being used to check the *identity* of a value, but equality
    /// does not necessarily imply identity. In this case, `compare_exchange` can lead to the
    /// [ABA problem].
    ///
    /// [ABA Problem]: https://en.wikipedia.org/wiki/ABA_problem
    /// [compare-and-swap operation]: https://en.wikipedia.org/wiki/Compare-and-swap
    #[inline]
    #[stable(feature = "extended_compare_and_swap", since = "1.10.0")]
    #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
    #[doc(alias = "compare_and_swap")]
    #[cfg(target_has_atomic = "8")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub const fn compare_exchange_weak(
        &self,
        current: bool,
        new: bool,
        success: Ordering,
        failure: Ordering,
    ) -> Result<bool, bool> {
        if EMULATE_ATOMIC_BOOL {
            return self.compare_exchange(current, new, success, failure);
        }

        // SAFETY: data races are prevented by atomic intrinsics.
        match unsafe {
            atomic_compare_exchange_weak(
                self.v.get().cast::<u8>(),
                current as u8,
                new as u8,
                success,
                failure,
            )
        } {
            Ok(x) => Ok(x != 0),
            Err(x) => Err(x != 0),
        }
    }

    /// 返回之前的值。
    ///
    /// Performs a logical "and" operation on the current value and the argument `val`, and sets
    /// the new value to the result.
    ///
    /// 返回之前的值。
    ///
    /// `fetch_and` takes an [`Ordering`] argument which describes the memory ordering
    /// of this operation. All ordering modes are possible. Note that using
    /// [`Acquire`] makes the store part of this operation [`Relaxed`], and
    /// using [`Release`] makes the load part [`Relaxed`].
    ///
    /// **Note:** This method is only available on platforms that support atomic
    /// operations on `u8`.
    ///
    /// # Examples
    ///
    /// ```
    /// use std::sync::atomic::{AtomicBool, Ordering};
    ///
    /// let foo = AtomicBool::new(true);
    /// assert_eq!(foo.fetch_and(false, Ordering::SeqCst), true);
    /// assert_eq!(foo.load(Ordering::SeqCst), false);
    ///
    /// let foo = AtomicBool::new(true);
    /// assert_eq!(foo.fetch_and(true, Ordering::SeqCst), true);
    /// assert_eq!(foo.load(Ordering::SeqCst), true);
    ///
    /// let foo = AtomicBool::new(false);
    /// assert_eq!(foo.fetch_and(false, Ordering::SeqCst), false);
    /// assert_eq!(foo.load(Ordering::SeqCst), false);
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
    #[cfg(target_has_atomic = "8")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub const fn fetch_and(&self, val: bool, order: Ordering) -> bool {
        // SAFETY: data races are prevented by atomic intrinsics.
        unsafe { atomic_and(self.v.get().cast::<u8>(), val as u8, order) != 0 }
    }

    /// 与布尔值进行逻辑“非”操作。
    ///
    /// Performs a logical "nand" operation on the current value and the argument `val`, and sets
    /// 返回之前的值。
    ///
    /// Returns the previous value.
    ///
    /// `fetch_nand` takes an [`Ordering`] argument which describes the memory ordering
    /// of this operation. All ordering modes are possible. Note that using
    /// [`Acquire`] makes the store part of this operation [`Relaxed`], and
    /// using [`Release`] makes the load part [`Relaxed`].
    ///
    /// **注意：** 该方法仅在支持原子操作的平台上可用。
    /// operations on `u8`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::atomic::{AtomicBool, Ordering};
    ///
    /// let foo = AtomicBool::new(true);
    /// assert_eq!(foo.fetch_nand(false, Ordering::SeqCst), true);
    /// assert_eq!(foo.load(Ordering::SeqCst), true);
    ///
    /// let foo = AtomicBool::new(true);
    /// assert_eq!(foo.fetch_nand(true, Ordering::SeqCst), true);
    /// assert_eq!(foo.load(Ordering::SeqCst) as usize, 0);
    /// assert_eq!(foo.load(Ordering::SeqCst), false);
    ///
    /// let foo = AtomicBool::new(false);
    /// assert_eq!(foo.fetch_nand(false, Ordering::SeqCst), false);
    /// assert_eq!(foo.load(Ordering::SeqCst), true);
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
    #[cfg(target_has_atomic = "8")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub const fn fetch_nand(&self, val: bool, order: Ordering) -> bool {
        // We can't use atomic_nand here because it can result in a bool with
        // an invalid value. This happens because the atomic operation is done
        // with an 8-bit integer internally, which would set the upper 7 bits.
        // So we just use fetch_xor or swap instead.
        if val {
            // !(x & true) == !x
            // We must invert the bool.
            self.fetch_xor(true, order)
        } else {
            // !(x & false) == true
            // We must set the bool to true.
            self.swap(true, order)
        }
    }

    /// 与布尔值进行逻辑“或”操作。
    ///
    /// Performs a logical "or" operation on the current value and the argument `val`, and sets the
    /// 返回之前的值。
    ///
    /// Returns the previous value.
    ///
    /// `fetch_or` takes an [`Ordering`] argument which describes the memory ordering
    /// of this operation. All ordering modes are possible. Note that using
    /// [`Acquire`] makes the store part of this operation [`Relaxed`], and
    /// using [`Release`] makes the load part [`Relaxed`].
    ///
    /// **注意：** 此方法仅适用于支持原子操作的平台。
    /// operations on `u8`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::atomic::{AtomicBool, Ordering};
    ///
    /// let foo = AtomicBool::new(true);
    /// assert_eq!(foo.fetch_or(false, Ordering::SeqCst), true);
    /// assert_eq!(foo.load(Ordering::SeqCst), true);
    ///
    /// let foo = AtomicBool::new(false);
    /// assert_eq!(foo.fetch_or(true, Ordering::SeqCst), false);
    /// assert_eq!(foo.load(Ordering::SeqCst), true);
    ///
    /// let foo = AtomicBool::new(false);
    /// assert_eq!(foo.fetch_or(false, Ordering::SeqCst), false);
    /// assert_eq!(foo.load(Ordering::SeqCst), false);
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
    #[cfg(target_has_atomic = "8")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub const fn fetch_or(&self, val: bool, order: Ordering) -> bool {
        // SAFETY: data races are prevented by atomic intrinsics.
        unsafe { atomic_or(self.v.get().cast::<u8>(), val as u8, order) != 0 }
    }

    /// 与布尔值进行逻辑“异或”操作。
    ///
    /// Performs a logical "xor" operation on the current value and the argument `val`, and sets
    /// 返回之前的值。
    ///
    /// 返回之前的值。
    ///
    /// `fetch_xor` takes an [`Ordering`] argument which describes the memory ordering
    /// of this operation. All ordering modes are possible. Note that using
    /// [`Acquire`] makes the store part of this operation [`Relaxed`], and
    /// using [`Release`] makes the load part [`Relaxed`].
    ///
    /// **注意：** 此方法仅适用于支持原子操作的平台。
    /// operations on `u8`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::atomic::{AtomicBool, Ordering};
    ///
    /// let foo = AtomicBool::new(true);
    /// assert_eq!(foo.fetch_xor(false, Ordering::SeqCst), true);
    /// assert_eq!(foo.load(Ordering::SeqCst), true);
    ///
    /// let foo = AtomicBool::new(true);
    /// assert_eq!(foo.fetch_xor(true, Ordering::SeqCst), true);
    /// assert_eq!(foo.load(Ordering::SeqCst), false);
    ///
    /// let foo = AtomicBool::new(false);
    /// assert_eq!(foo.fetch_xor(false, Ordering::SeqCst), false);
    /// assert_eq!(foo.load(Ordering::SeqCst), false);
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
    #[cfg(target_has_atomic = "8")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub const fn fetch_xor(&self, val: bool, order: Ordering) -> bool {
        // SAFETY: data races are prevented by atomic intrinsics.
        unsafe { atomic_xor(self.v.get().cast::<u8>(), val as u8, order) != 0 }
    }

    /// 与布尔值进行逻辑“非”操作。
    ///
    /// 对当前值执行逻辑“非”操作，并将新值设置为结果。
    /// 返回之前的值。
    ///
    /// 返回之前的值。
    ///
    /// `fetch_not` takes an [`Ordering`] argument which describes the memory ordering
    /// of this operation. All ordering modes are possible. Note that using
    /// [`Acquire`] makes the store part of this operation [`Relaxed`], and
    /// using [`Release`] makes the load part [`Relaxed`].
    ///
    /// **注意：** 此方法仅适用于支持原子操作的平台。
    /// operations on `u8`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::atomic::{AtomicBool, Ordering};
    ///
    /// let foo = AtomicBool::new(true);
    /// assert_eq!(foo.fetch_not(Ordering::SeqCst), true);
    /// assert_eq!(foo.load(Ordering::SeqCst), false);
    ///
    /// let foo = AtomicBool::new(false);
    /// assert_eq!(foo.fetch_not(Ordering::SeqCst), false);
    /// assert_eq!(foo.load(Ordering::SeqCst), true);
    /// ```
    #[inline]
    #[stable(feature = "atomic_bool_fetch_not", since = "1.81.0")]
    #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
    #[cfg(target_has_atomic = "8")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub const fn fetch_not(&self, order: Ordering) -> bool {
        self.fetch_xor(true, order)
    }

    /// Returns a mutable pointer to the underlying [`bool`].
    ///
    /// 在生成的布尔值上进行非原子读取和写入可能会导致数据竞争。
    /// 此方法主要用于 FFI，其中函数签名可能使用
    /// `*mut bool` instead of `&AtomicBool`.
    ///
    /// Returning an `*mut` pointer from a shared reference to this atomic is safe because the
    /// 原子类型支持内部可变性。所有对原子的修改都通过共享引用改变值，只要使用原子操作，就可以安全地进行。任何
    /// through a shared reference, and can do so safely as long as they use atomic operations. Any
    /// use of the returned raw pointer requires an `unsafe` block and still has to uphold the
    /// requirements of the [memory model].
    ///
    /// # 获取值，并应用一个返回可选新值的函数。如果函数
    ///
    /// ```ignore (extern-declaration)
    /// # fn main() {
    /// use std::sync::atomic::AtomicBool;
    ///
    /// extern "C" {
    ///     fn my_atomic_op(arg: *mut bool);
    /// }
    ///
    /// let mut atomic = AtomicBool::new(true);
    /// unsafe {
    ///     my_atomic_op(atomic.as_ptr());
    /// }
    /// # }
    /// ```
    ///
    /// [memory model]: self#memory-model-for-atomic-accesses
    #[inline]
    #[stable(feature = "atomic_as_ptr", since = "1.70.0")]
    #[rustc_const_stable(feature = "atomic_as_ptr", since = "1.70.0")]
    #[lint::never_returns_null_ptr]
    #[lint::should_not_be_called_on_const_items]
    pub const fn as_ptr(&self) -> *mut bool {
        self.v.get().cast()
    }

    /// An alias for [`AtomicBool::try_update`].
    #[inline]
    #[stable(feature = "atomic_fetch_update", since = "1.53.0")]
    #[cfg(target_has_atomic = "8")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    #[deprecated(
        since = "1.99.0",
        note = "renamed to `try_update` for consistency",
        suggestion = "try_update"
    )]
    pub fn fetch_update<F>(
        &self,
        set_order: Ordering,
        fetch_order: Ordering,
        f: F,
    ) -> Result<bool, bool>
    where
        F: FnMut(bool) -> Option<bool>,
    {
        self.try_update(set_order, fetch_order, f)
    }

    /// Fetches the value, and applies a function to it that returns an optional
    /// new value. Returns a `Result` of `Ok(previous_value)` if the function
    /// returned `Some(_)`, else `Err(previous_value)`.
    ///
    /// See also: [`update`](`AtomicBool::update`).
    ///
    /// Note: This may call the function multiple times if the value has been
    /// changed from other threads in the meantime, as long as the function
    /// returns `Some(_)`, but the function will have been applied only once to
    /// 存储的值。
    ///
    /// `try_update` takes two [`Ordering`] arguments to describe the memory
    /// 此操作的排序规则。第一个参数描述了所需的排序方式，
    /// 当操作最终成功时，第二个参数描述了
    /// 加载所需的排序方式。这些分别对应成功的和失败的
    /// orderings of [`AtomicBool::compare_exchange`] respectively.
    ///
    /// Using [`Acquire`] as success ordering makes the store part of this
    /// operation [`Relaxed`], and using [`Release`] makes the final successful
    /// load [`Relaxed`]. The (failed) load ordering can only be [`SeqCst`],
    /// [`Acquire`] or [`Relaxed`].
    ///
    /// **Note:** This method is only available on platforms that support atomic
    /// operations on `u8`.
    ///
    /// # 注意事项
    ///
    /// 该方法并非魔法；它不是由硬件提供的，也不像
    /// 关键段或互斥锁那样工作。
    ///
    /// 它是基于原子 [比较与交换操作] 实现的，因此存在
    /// CAS 操作的常见缺点。特别是要小心 [ABA 问题]。
    ///
    /// [ABA Problem]: https://en.wikipedia.org/wiki/ABA_problem
    /// [compare-and-swap operation]: https://en.wikipedia.org/wiki/Compare-and-swap
    ///
    /// # 示例
    ///
    /// ```rust
    /// use std::sync::atomic::{AtomicBool, Ordering};
    ///
    /// let x = AtomicBool::new(false);
    /// assert_eq!(x.try_update(Ordering::SeqCst, Ordering::SeqCst, |_| None), Err(false));
    /// assert_eq!(x.try_update(Ordering::SeqCst, Ordering::SeqCst, |x| Some(!x)), Ok(false));
    /// assert_eq!(x.try_update(Ordering::SeqCst, Ordering::SeqCst, |x| Some(!x)), Ok(true));
    /// assert_eq!(x.load(Ordering::SeqCst), false);
    /// ```
    #[inline]
    #[stable(feature = "atomic_try_update", since = "1.95.0")]
    #[cfg(target_has_atomic = "8")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub fn try_update(
        &self,
        set_order: Ordering,
        fetch_order: Ordering,
        mut f: impl FnMut(bool) -> Option<bool>,
    ) -> Result<bool, bool> {
        let mut prev = self.load(fetch_order);
        while let Some(next) = f(prev) {
            match self.compare_exchange_weak(prev, next, set_order, fetch_order) {
                x @ Ok(_) => return x,
                Err(next_prev) => prev = next_prev,
            }
        }
        Err(prev)
    }

    /// 获取值，并应用一个返回新值的函数。
    /// 新值被存储，旧值被返回。
    ///
    /// See also: [`try_update`](`AtomicBool::try_update`).
    ///
    /// 注意：如果值在期间被其他线程更改，该函数可能会多次调用，但函数只会对存储的值应用一次。
    /// 
    ///
    /// `update` takes two [`Ordering`] arguments to describe the memory
    /// 此操作的排序规则。第一个参数描述了所需的排序方式，
    /// 当操作最终成功时，第二个参数描述了
    /// 加载所需的排序方式。这些分别对应成功的和失败的
    /// orderings of [`AtomicBool::compare_exchange`] respectively.
    ///
    /// Using [`Acquire`] as success ordering makes the store part
    /// of this operation [`Relaxed`], and using [`Release`] makes the final successful load
    /// [`Relaxed`]. The (failed) load ordering can only be [`SeqCst`], [`Acquire`] or [`Relaxed`].
    ///
    /// **Note:** This method is only available on platforms that support atomic operations on `u8`.
    ///
    /// # 注意事项
    ///
    /// 该方法并非魔法；它不是由硬件提供的，也不像
    /// 关键段或互斥锁那样工作。
    ///
    /// 它是基于原子 [比较与交换操作] 实现的，因此存在
    /// CAS 操作的常见缺点。特别是要小心 [ABA 问题]。
    ///
    /// [ABA Problem]: https://en.wikipedia.org/wiki/ABA_problem
    /// [compare-and-swap operation]: https://en.wikipedia.org/wiki/Compare-and-swap
    ///
    /// # 示例
    ///
    /// ```rust
    ///
    /// use std::sync::atomic::{AtomicBool, Ordering};
    ///
    /// let x = AtomicBool::new(false);
    /// assert_eq!(x.update(Ordering::SeqCst, Ordering::SeqCst, |x| !x), false);
    /// assert_eq!(x.update(Ordering::SeqCst, Ordering::SeqCst, |x| !x), true);
    /// assert_eq!(x.load(Ordering::SeqCst), false);
    /// ```
    #[inline]
    #[stable(feature = "atomic_try_update", since = "1.95.0")]
    #[cfg(target_has_atomic = "8")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub fn update(
        &self,
        set_order: Ordering,
        fetch_order: Ordering,
        mut f: impl FnMut(bool) -> bool,
    ) -> bool {
        let mut prev = self.load(fetch_order);
        loop {
            match self.compare_exchange_weak(prev, f(prev), set_order, fetch_order) {
                Ok(x) => break x,
                Err(next_prev) => prev = next_prev,
            }
        }
    }
}

#[cfg(target_has_atomic_load_store = "ptr")]
impl<T> AtomicPtr<T> {
    /// Creates a new `AtomicPtr`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::atomic::AtomicPtr;
    ///
    /// let ptr = &mut 5;
    /// let atomic_ptr = AtomicPtr::new(ptr);
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_stable(feature = "const_atomic_new", since = "1.24.0")]
    pub const fn new(p: *mut T) -> AtomicPtr<T> {
        // SAFETY:
        // `Atomic<T>` is essentially a transparent wrapper around `T`.
        unsafe { transmute(p) }
    }

    /// Creates a new `AtomicPtr` from a pointer.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::atomic::{self, AtomicPtr};
    ///
    /// // Get a pointer to an allocated value
    /// let ptr: *mut *mut u8 = Box::into_raw(Box::new(std::ptr::null_mut()));
    ///
    /// assert!(ptr.cast::<AtomicPtr<u8>>().is_aligned());
    ///
    /// {
    ///     // Create an atomic view of the allocated value
    ///     let atomic = unsafe { AtomicPtr::from_ptr(ptr) };
    ///
    ///     // Use `atomic` for atomic operations, possibly share it with other threads
    ///     atomic.store(std::ptr::NonNull::dangling().as_ptr(), atomic::Ordering::Relaxed);
    /// }
    ///
    /// // It's ok to non-atomically access the value behind `ptr`,
    /// // since the reference to the atomic ended its lifetime in the block above
    /// assert!(!unsafe { *ptr }.is_null());
    ///
    /// // Deallocate the value
    /// unsafe { drop(Box::from_raw(ptr)) }
    /// ```
    ///
    /// # 安全性
    ///
    /// * `ptr` must be aligned to `align_of::<AtomicPtr<T>>()` (note that on some platforms this
    ///   can be bigger than `align_of::<*mut T>()`).
    /// * `ptr` must be [valid] for both reads and writes for the whole lifetime `'a`.
    /// * 你必须遵循 [原子访问的内存模型]。特别是，不允许混合冲突的原子与非原子访问，或不同
    /// 大小的原子访问，而不进行同步。
    ///   sizes, without synchronization.
    ///
    /// [valid]: crate::ptr#safety
    /// [Memory model for atomic accesses]: self#memory-model-for-atomic-accesses
    #[inline]
    #[stable(feature = "atomic_from_ptr", since = "1.75.0")]
    #[rustc_const_stable(feature = "const_atomic_from_ptr", since = "1.84.0")]
    pub const unsafe fn from_ptr<'a>(ptr: *mut *mut T) -> &'a AtomicPtr<T> {
        // SAFETY: guaranteed by the caller
        unsafe { &*ptr.cast() }
    }

    /// Creates a new pointer to `AtomicPtr` from a pointer.
    ///
    /// 对目标对象的引用，这是非常有用的。
    /// a reference to the destination.
    #[inline]
    #[unstable(feature = "atomic_volatile", issue = "158947")]
    pub const fn from_ptr_raw(ptr: *mut *mut T) -> *const AtomicPtr<T> {
        ptr.cast_const().cast()
    }

    /// Creates a new `AtomicPtr` initialized with a null pointer.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(atomic_ptr_null)]
    /// use std::sync::atomic::{AtomicPtr, Ordering};
    ///
    /// let atomic_ptr = AtomicPtr::<()>::null();
    /// assert!(atomic_ptr.load(Ordering::Relaxed).is_null());
    /// ```
    #[inline]
    #[must_use]
    #[unstable(feature = "atomic_ptr_null", issue = "150733")]
    pub const fn null() -> AtomicPtr<T> {
        AtomicPtr::new(crate::ptr::null_mut())
    }

    /// 返回对底层指针的可变引用。
    ///
    /// 这是安全的，因为可变引用保证没有其他线程同时访问原子数据。
    /// 在同步的情况下。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::atomic::{AtomicPtr, Ordering};
    ///
    /// let mut data = 10;
    /// let mut atomic_ptr = AtomicPtr::new(&mut data);
    /// let mut other_data = 5;
    /// *atomic_ptr.get_mut() = &mut other_data;
    /// assert_eq!(unsafe { *atomic_ptr.load(Ordering::SeqCst) }, 5);
    /// ```
    #[inline]
    #[stable(feature = "atomic_access", since = "1.15.0")]
    #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
    pub const fn get_mut(&mut self) -> &mut *mut T {
        // SAFETY:
        // `Atomic<T>` is essentially a transparent wrapper around `T`.
        unsafe { &mut *self.as_ptr() }
    }

    /// 获得对指针的原子访问权限。
    ///
    /// **Note:** This function is only available on targets where `AtomicPtr<T>` has the same alignment as `*const T`
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::atomic::{AtomicPtr, Ordering};
    ///
    /// let mut data = 123;
    /// let mut some_ptr = &mut data as *mut i32;
    /// let a = AtomicPtr::from_mut(&mut some_ptr);
    /// let mut other_data = 456;
    /// a.store(&mut other_data, Ordering::Relaxed);
    /// assert_eq!(unsafe { *some_ptr }, 456);
    /// ```
    #[inline]
    #[cfg(target_has_atomic_primitive_alignment = "ptr")]
    #[stable(feature = "atomic_from_mut", since = "1.98.0")]
    #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
    pub const fn from_mut(v: &mut *mut T) -> &mut Self {
        let [] = [(); align_of::<AtomicPtr<()>>() - align_of::<*mut ()>()];
        // SAFETY:
        //  - the mutable reference guarantees unique ownership.
        //  - the alignment of `*mut T` and `Self` is the same on all platforms
        //    supported by rust, as verified above.
        unsafe { &mut *(v as *mut *mut T as *mut Self) }
    }

    /// Gets non-atomic access to a `&mut [AtomicPtr]` slice.
    ///
    /// 这是安全的，因为可变引用保证没有其他线程同时访问原子数据。
    /// 在同步的情况下。
    ///
    /// # 示例
    ///
    /// ```ignore-wasm
    /// use std::ptr::null_mut;
    /// use std::sync::atomic::{AtomicPtr, Ordering};
    ///
    /// let mut some_ptrs = [const { AtomicPtr::new(null_mut::<String>()) }; 10];
    ///
    /// let view: &mut [*mut String] = AtomicPtr::get_mut_slice(&mut some_ptrs);
    /// assert_eq!(view, [null_mut::<String>(); 10]);
    /// view
    ///     .iter_mut()
    ///     .enumerate()
    ///     .for_each(|(i, ptr)| *ptr = Box::into_raw(Box::new(format!("iteration#{i}"))));
    ///
    /// std::thread::scope(|s| {
    ///     for ptr in &some_ptrs {
    ///         s.spawn(move || {
    ///             let ptr = ptr.load(Ordering::Relaxed);
    ///             assert!(!ptr.is_null());
    ///
    ///             let name = unsafe { Box::from_raw(ptr) };
    ///             println!("Hello, {name}!");
    ///         });
    ///     }
    /// });
    /// ```
    #[inline]
    #[stable(feature = "atomic_from_mut", since = "1.98.0")]
    #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
    pub const fn get_mut_slice(this: &mut [Self]) -> &mut [*mut T] {
        // SAFETY: the mutable reference guarantees unique ownership.
        unsafe { &mut *(this as *mut [Self] as *mut [*mut T]) }
    }

    /// 获得对指针切片的原子访问权限。
    ///
    /// **Note:** This function is only available on targets where `AtomicPtr<T>` has the same alignment as `*const T`
    ///
    /// # 示例
    ///
    /// ```ignore-wasm
    /// use std::ptr::null_mut;
    /// use std::sync::atomic::{AtomicPtr, Ordering};
    ///
    /// let mut some_ptrs = [null_mut::<String>(); 10];
    /// let a = &*AtomicPtr::from_mut_slice(&mut some_ptrs);
    /// std::thread::scope(|s| {
    ///     for i in 0..a.len() {
    ///         s.spawn(move || {
    ///             let name = Box::new(format!("thread{i}"));
    ///             a[i].store(Box::into_raw(name), Ordering::Relaxed);
    ///         });
    ///     }
    /// });
    /// for p in some_ptrs {
    ///     assert!(!p.is_null());
    ///     let name = unsafe { Box::from_raw(p) };
    ///     println!("Hello, {name}!");
    /// }
    /// ```
    #[inline]
    #[cfg(target_has_atomic_primitive_alignment = "ptr")]
    #[stable(feature = "atomic_from_mut", since = "1.98.0")]
    #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
    pub const fn from_mut_slice(v: &mut [*mut T]) -> &mut [Self] {
        // SAFETY:
        //  - the mutable reference guarantees unique ownership.
        //  - the alignment of `*mut T` and `Self` is the same on all platforms
        //    supported by rust, as verified above.
        unsafe { &mut *(v as *mut [*mut T] as *mut [Self]) }
    }

    /// 消耗原子数据并返回所包含的值。
    ///
    /// This is safe because passing `self` by value guarantees that no other threads are
    /// 在同步的情况下。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::atomic::AtomicPtr;
    ///
    /// let mut data = 5;
    /// let atomic_ptr = AtomicPtr::new(&mut data);
    /// assert_eq!(unsafe { *atomic_ptr.into_inner() }, 5);
    /// ```
    #[inline]
    #[stable(feature = "atomic_access", since = "1.15.0")]
    #[rustc_const_stable(feature = "const_atomic_into_inner", since = "1.79.0")]
    pub const fn into_inner(self) -> *mut T {
        // SAFETY:
        // `Atomic<T>` is essentially a transparent wrapper around `T`.
        unsafe { transmute(self) }
    }

    /// 从指针加载一个值。
    ///
    /// `load` takes an [`Ordering`] argument which describes the memory ordering
    /// of this operation. Possible values are [`SeqCst`], [`Acquire`] and [`Relaxed`].
    ///
    /// # 恐慌
    ///
    /// Panics if `order` is [`Release`] or [`AcqRel`].
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::atomic::{AtomicPtr, Ordering};
    ///
    /// let ptr = &mut 5;
    /// let some_ptr = AtomicPtr::new(ptr);
    ///
    /// let value = some_ptr.load(Ordering::Relaxed);
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    pub const fn load(&self, order: Ordering) -> *mut T {
        // SAFETY: data races are prevented by atomic intrinsics.
        unsafe {
            atomic_load::<_, /* VOLATILE */ false>(self.as_ptr(), order)
        }
    }

    /// 从指针执行易失性原子加载操作。
    ///
    /// `load_volatile` takes an [`Ordering`] argument which describes the memory ordering
    /// of this operation. Possible values are [`SeqCst`], [`Acquire`] and [`Relaxed`].
    ///
    #[doc = include_str!("./atomic_load_volatile.md")]
    ///
    /// # 安全性
    ///
    /// 如果违反以下任何条件，行为将未定义：
    ///
    /// * `self` must be [valid] for reads, or `self` must point to memory
    /// 所有 Rust 分配之外的内存，并且从该内存读取时必须：
    /// - 不会触发异常，并且
    /// - 不会修改 Rust 分配中的任何内存。
    ///
    /// * `self` must be aligned to `align_of::<AtomicPtr<T>>()` (note that on some platforms this
    ///   can be bigger than `align_of::<*mut T>()`).
    ///
    /// * Reading from `self` must produce a properly initialized value of type `*mut T`.
    ///
    /// [valid]: core::ptr#safety
    ///
    /// # 异常
    ///
    /// Panics if `order` is [`Release`] or [`AcqRel`].
    ///
    /// # 示例
    ///
    /// Assuming an MMIO region at `MMIO_ADDR` that belongs to a device with direct memory
    /// 将值存储到指针中。
    ///
    /// ```rust,no_run
    /// #![feature(atomic_volatile)]
    /// use std::sync::atomic::{fence, AtomicPtr, Ordering};
    /// use std::ptr;
    ///
    /// const MMIO_ADDR: *mut *mut u8 = ptr::without_provenance_mut(0xCAF0);
    /// let atomic_ptr = AtomicPtr::<u8>::from_ptr_raw(MMIO_ADDR);
    ///
    /// // Spin until we see a non-zero value.
    /// let buf = 'buf: loop {
    ///     let buf = unsafe { atomic_ptr.load_volatile(Ordering::Relaxed) };
    ///     if !buf.is_null() {
    ///         break 'buf buf;
    ///     }
    /// };
    /// // Synchronize with the store whose value we just read.
    /// // Note: a standard acquire fence may not be sufficient to synchronize with DMA devices.
    /// // Depending on your target, you may have to use inline assembly to emit a special fence.
    /// fence(Ordering::Acquire);
    ///
    /// // Now process the data in `buf`.
    /// ```
    #[inline]
    #[unstable(feature = "atomic_volatile", issue = "158947")]
    #[rustc_const_unstable(feature = "atomic_volatile", issue = "158947")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    pub const unsafe fn load_volatile(self: *const Self, order: Ordering) -> *mut T {
        // SAFETY: follows from our own safety requirements.
        unsafe {
            atomic_load::<_, /* VOLATILE */ true>(self.cast::<*mut T>(), order)
        }
    }

    /// Stores a value into the pointer.
    ///
    /// `store` takes an [`Ordering`] argument which describes the memory ordering
    /// of this operation. Possible values are [`SeqCst`], [`Release`] and [`Relaxed`].
    ///
    /// # 示例
    ///
    /// Panics if `order` is [`Acquire`] or [`AcqRel`].
    ///
    /// # Examples
    ///
    /// ```
    /// use std::sync::atomic::{AtomicPtr, Ordering};
    ///
    /// let ptr = &mut 5;
    /// let some_ptr = AtomicPtr::new(ptr);
    ///
    /// let other_ptr = &mut 10;
    ///
    /// some_ptr.store(other_ptr, Ordering::Relaxed);
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub const fn store(&self, ptr: *mut T, order: Ordering) {
        // SAFETY: data races are prevented by atomic intrinsics.
        unsafe {
            atomic_store::<_, /* VOLATILE */ false>(self.as_ptr(), ptr, order);
        }
    }

    /// 执行对指针的易失性原子存储操作。
    ///
    /// `store_volatile` takes an [`Ordering`] argument which describes the memory ordering
    /// of this operation. Possible values are [`SeqCst`], [`Release`] and [`Relaxed`].
    ///
    #[doc = include_str!("./atomic_store_volatile.md")]
    ///
    /// # 如果违反以下任何条件，行为未定义：
    ///
    /// Behavior is undefined if any of the following conditions are violated:
    ///
    /// * `self` must be either [valid] for writes, or `self` must point to memory
    /// - 不会修改 Rust 分配中的任何内存。
    ///   - not trap, and
    ///   - not cause any memory inside a Rust allocation to be modified.
    ///
    /// * `self` must be aligned to `align_of::<AtomicPtr<T>>()` (note that on some platforms this
    ///   can be bigger than `align_of::<*mut T>()`).
    ///
    /// [valid]: core::ptr#safety
    ///
    /// # 示例
    ///
    /// Panics if `order` is [`Acquire`] or [`AcqRel`].
    ///
    /// # 示例
    ///
    /// Assuming an MMIO region at `MMIO_ADDR` that belongs to a device with direct memory
    /// 将值存储到指针中，并返回之前的值。
    ///
    /// ```rust,no_run
    /// #![feature(atomic_volatile)]
    /// use std::sync::atomic::{fence, AtomicPtr, Ordering};
    /// use std::ptr;
    ///
    /// const MMIO_ADDR: *mut *mut u8 = ptr::without_provenance_mut(0xCAF0);
    /// let atomic_ptr = AtomicPtr::<u8>::from_ptr_raw(MMIO_ADDR);
    ///
    /// // Prepare some data for the DMA device.
    /// # fn get_dma_buffer() -> *mut u8 { panic!() }
    /// let buf = get_dma_buffer();
    ///
    /// // Ensure the other side can synchronize with the store we do below.
    /// // Note: a standard release fence may not be sufficient to synchronize with DMA devices.
    /// // Depending on your target, you may have to use inline assembly to emit a special fence.
    /// fence(Ordering::Release);
    ///
    /// unsafe { atomic_ptr.store_volatile(buf, Ordering::Relaxed) };
    /// ```
    #[inline]
    #[unstable(feature = "atomic_volatile", issue = "158947")]
    #[rustc_const_unstable(feature = "atomic_volatile", issue = "158947")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub const unsafe fn store_volatile(self: *const Self, ptr: *mut T, order: Ordering) {
        // SAFETY: follows from our own safety requirements.
        unsafe {
            atomic_store::<_, /* VOLATILE */ true>(self.cast::<*mut T>().cast_mut(), ptr, order);
        }
    }

    /// Stores a value into the pointer, returning the previous value.
    ///
    /// `swap` takes an [`Ordering`] argument which describes the memory ordering
    /// of this operation. All ordering modes are possible. Note that using
    /// [`Acquire`] makes the store part of this operation [`Relaxed`], and
    /// using [`Release`] makes the load part [`Relaxed`].
    ///
    /// **Note:** This method is only available on platforms that support atomic
    /// operations on pointers.
    ///
    /// # Examples
    ///
    /// ```
    /// use std::sync::atomic::{AtomicPtr, Ordering};
    ///
    /// let ptr = &mut 5;
    /// let some_ptr = AtomicPtr::new(ptr);
    ///
    /// let other_ptr = &mut 10;
    ///
    /// let value = some_ptr.swap(other_ptr, Ordering::Relaxed);
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
    #[cfg(target_has_atomic = "ptr")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub const fn swap(&self, ptr: *mut T, order: Ordering) -> *mut T {
        // SAFETY: data races are prevented by atomic intrinsics.
        unsafe { atomic_swap(self.as_ptr(), ptr, order) }
    }

    /// Stores a value into the pointer if the current value is the same as the `current` value.
    ///
    /// The return value is always the previous value. If it is equal to `current`, then the value
    /// was updated.
    ///
    /// `compare_and_swap` also takes an [`Ordering`] argument which describes the memory
    /// ordering of this operation. Notice that even when using [`AcqRel`], the operation
    /// might fail and hence just perform an `Acquire` load, but not have `Release` semantics.
    /// Using [`Acquire`] makes the store part of this operation [`Relaxed`] if it
    /// happens, and using [`Release`] makes the load part [`Relaxed`].
    ///
    /// **注意：** 该方法仅在支持原子
    /// 对指针操作的平台上可用。
    ///
    /// # Migrating to `compare_exchange` and `compare_exchange_weak`
    ///
    /// `compare_and_swap` is equivalent to `compare_exchange` with the following mapping for
    /// 内存排序：
    ///
    /// 原始状态 | 成功 | 失败
    /// -------- | ------- | -------
    /// 宽松的   | 宽松的 | 宽松的
    /// 获取   | 获取   | 获取
    /// 释放   | 释放   | 宽松的
    /// AcqRel   | AcqRel  | 获取
    /// SeqCst   | SeqCst  | SeqCst
    ///
    /// `compare_and_swap` and `compare_exchange` also differ in their return type. You can use
    /// `compare_exchange(...).unwrap_or_else(|x| x)` to recover the behavior of `compare_and_swap`,
    /// but in most cases it is more idiomatic to check whether the return value is `Ok` or `Err`
    /// 比根据读取的值推断成功与失败更符合编程习惯。
    ///
    /// During migration, consider whether it makes sense to use `compare_exchange_weak` instead.
    /// `compare_exchange_weak` is allowed to fail spuriously even when the comparison succeeds,
    /// 这允许编译器在比较和交换
    /// 在循环中使用时生成更好的汇编代码。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::atomic::{AtomicPtr, Ordering};
    ///
    /// let ptr = &mut 5;
    /// let some_ptr = AtomicPtr::new(ptr);
    ///
    /// let other_ptr = &mut 10;
    ///
    /// let value = some_ptr.compare_and_swap(ptr, other_ptr, Ordering::Relaxed);
    /// ```
    #[inline]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[deprecated(
        since = "1.50.0",
        note = "Use `compare_exchange` or `compare_exchange_weak` instead"
    )]
    #[cfg(target_has_atomic = "ptr")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub fn compare_and_swap(&self, current: *mut T, new: *mut T, order: Ordering) -> *mut T {
        match self.compare_exchange(current, new, order, strongest_failure_ordering(order)) {
            Ok(x) => x,
            Err(x) => x,
        }
    }

    /// Stores a value into the pointer if the current value is the same as the `current` value.
    ///
    /// 返回值是一个结果，指示新值是否已被写入，并包含
    /// the previous value. On success this value is guaranteed to be equal to `current`.
    ///
    /// `compare_exchange` takes two [`Ordering`] arguments to describe the memory
    /// ordering of this operation. `success` describes the required ordering for the
    /// read-modify-write operation that takes place if the comparison with `current` succeeds.
    /// `failure` describes the required ordering for the load operation that takes place when
    /// the comparison fails. Using [`Acquire`] as success ordering makes the store part
    /// of this operation [`Relaxed`], and using [`Release`] makes the successful load
    /// [`Relaxed`]. The failure ordering can only be [`SeqCst`], [`Acquire`] or [`Relaxed`].
    ///
    /// 对指针操作的平台上可用。
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::atomic::{AtomicPtr, Ordering};
    ///
    /// let ptr = &mut 5;
    /// let some_ptr = AtomicPtr::new(ptr);
    ///
    /// let other_ptr = &mut 10;
    ///
    /// let value = some_ptr.compare_exchange(ptr, other_ptr,
    ///                                       Ordering::SeqCst, Ordering::Relaxed);
    /// ```
    ///
    /// # 考虑因素
    ///
    /// `compare_exchange` is a [compare-and-swap operation] and thus exhibits the usual downsides
    /// 在 CAS 操作中。特别是，先读取值然后成功执行
    /// `compare_exchange` with the previous load *does not ensure* that other threads have not
    /// 在此期间更改了值。当使用*相等性*检查时，这通常很重要
    /// the `compare_exchange` is being used to check the *identity* of a value, but equality
    /// 并不必然意味着身份。对于指针来说，这是一个特别常见的情况，因为
    /// a pointer holding the same address does not imply that the same object exists at that
    /// address! In this case, `compare_exchange` can lead to the [ABA problem].
    ///
    /// [ABA Problem]: https://en.wikipedia.org/wiki/ABA_problem
    /// [compare-and-swap operation]: https://en.wikipedia.org/wiki/Compare-and-swap
    #[inline]
    #[stable(feature = "extended_compare_and_swap", since = "1.10.0")]
    #[cfg(target_has_atomic = "ptr")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub fn compare_exchange(
        &self,
        current: *mut T,
        new: *mut T,
        success: Ordering,
        failure: Ordering,
    ) -> Result<*mut T, *mut T> {
        // SAFETY: data races are prevented by atomic intrinsics.
        unsafe { atomic_compare_exchange(self.as_ptr(), current, new, success, failure) }
    }

    /// Stores a value into the pointer if the current value is the same as the `current` value.
    ///
    /// Unlike [`AtomicPtr::compare_exchange`], this function is allowed to spuriously fail even when the
    /// 之前的值。
    /// return value is a result indicating whether the new value was written and containing the
    /// previous value.
    ///
    /// `compare_exchange_weak` takes two [`Ordering`] arguments to describe the memory
    /// ordering of this operation. `success` describes the required ordering for the
    /// read-modify-write operation that takes place if the comparison with `current` succeeds.
    /// `failure` describes the required ordering for the load operation that takes place when
    /// the comparison fails. Using [`Acquire`] as success ordering makes the store part
    /// of this operation [`Relaxed`], and using [`Release`] makes the successful load
    /// [`Relaxed`]. The failure ordering can only be [`SeqCst`], [`Acquire`] or [`Relaxed`].
    ///
    /// **Note:** This method is only available on platforms that support atomic
    /// 并不必然意味着身份。对于指针来说，这是一个特别常见的情况，因为
    ///
    /// # Examples
    ///
    /// ```
    /// use std::sync::atomic::{AtomicPtr, Ordering};
    ///
    /// let some_ptr = AtomicPtr::new(&mut 5);
    ///
    /// let new = &mut 10;
    /// let mut old = some_ptr.load(Ordering::Relaxed);
    /// loop {
    ///     match some_ptr.compare_exchange_weak(old, new, Ordering::SeqCst, Ordering::Relaxed) {
    ///         Ok(_) => break,
    ///         Err(x) => old = x,
    ///     }
    /// }
    /// ```
    ///
    /// # Considerations
    ///
    /// `compare_exchange` is a [compare-and-swap operation] and thus exhibits the usual downsides
    /// of CAS operations. In particular, a load of the value followed by a successful
    /// `compare_exchange` with the previous load *does not ensure* that other threads have not
    /// changed the value in the interim. This is usually important when the *equality* check in
    /// the `compare_exchange` is being used to check the *identity* of a value, but equality
    /// does not necessarily imply identity. This is a particularly common case for pointers, as
    /// a pointer holding the same address does not imply that the same object exists at that
    /// address! In this case, `compare_exchange` can lead to the [ABA problem].
    ///
    /// [ABA Problem]: https://en.wikipedia.org/wiki/ABA_problem
    /// [compare-and-swap operation]: https://en.wikipedia.org/wiki/Compare-and-swap
    #[inline]
    #[stable(feature = "extended_compare_and_swap", since = "1.10.0")]
    #[cfg(target_has_atomic = "ptr")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub fn compare_exchange_weak(
        &self,
        current: *mut T,
        new: *mut T,
        success: Ordering,
        failure: Ordering,
    ) -> Result<*mut T, *mut T> {
        // SAFETY: This intrinsic is unsafe because it operates on a raw pointer
        // but we know for sure that the pointer is valid (we just got it from
        // an `UnsafeCell` that we have by reference) and the atomic operation
        // itself allows us to safely mutate the `UnsafeCell` contents.
        unsafe { atomic_compare_exchange_weak(self.as_ptr(), current, new, success, failure) }
    }

    /// An alias for [`AtomicPtr::try_update`].
    #[inline]
    #[stable(feature = "atomic_fetch_update", since = "1.53.0")]
    #[cfg(target_has_atomic = "ptr")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    #[deprecated(
        since = "1.99.0",
        note = "renamed to `try_update` for consistency",
        suggestion = "try_update"
    )]
    pub fn fetch_update<F>(
        &self,
        set_order: Ordering,
        fetch_order: Ordering,
        f: F,
    ) -> Result<*mut T, *mut T>
    where
        F: FnMut(*mut T) -> Option<*mut T>,
    {
        self.try_update(set_order, fetch_order, f)
    }
    /// 获取值，并应用一个返回可选值的函数。
    /// new value. Returns a `Result` of `Ok(previous_value)` if the function
    /// returned `Some(_)`, else `Err(previous_value)`.
    ///
    /// See also: [`update`](`AtomicPtr::update`).
    ///
    /// Note: This may call the function multiple times if the value has been
    /// changed from other threads in the meantime, as long as the function
    /// returns `Some(_)`, but the function will have been applied only once to
    /// the stored value.
    ///
    /// `try_update` takes two [`Ordering`] arguments to describe the memory
    /// ordering of this operation. The first describes the required ordering for
    /// **注意：**此方法仅在支持原子操作的平台上可用。
    /// # 注意事项
    /// orderings of [`AtomicPtr::compare_exchange`] respectively.
    ///
    /// Using [`Acquire`] as success ordering makes the store part of this
    /// operation [`Relaxed`], and using [`Release`] makes the final successful
    /// load [`Relaxed`]. The (failed) load ordering can only be [`SeqCst`],
    /// [`Acquire`] or [`Relaxed`].
    ///
    /// 新值被存储，旧值被返回。
    /// operations on pointers.
    ///
    /// # 考虑事项
    ///
    /// 此方法并非魔法；它不是由硬件提供的，也不像临界区或互斥锁那样工作。
    /// 它是在原子[比较与交换操作]之上实现的，因此受到CAS操作的常见缺点影响。特别是要注意[ABA问题]，这是指针常见的陷阱！
    ///
    /// 它是在原子[比较与交换操作]之上实现的，因此受到CAS操作的常见缺点影响。特别是要注意[ABA问题]，这是指针常见的陷阱！
    /// **注意：**此方法仅在支持原子操作的平台上可用。
    /// # 示例
    ///
    /// [ABA Problem]: https://en.wikipedia.org/wiki/ABA_problem
    /// [compare-and-swap operation]: https://en.wikipedia.org/wiki/Compare-and-swap
    ///
    /// # 获取值，并应用一个返回新值的函数。
    ///
    /// ```rust
    /// use std::sync::atomic::{AtomicPtr, Ordering};
    ///
    /// let ptr: *mut _ = &mut 5;
    /// let some_ptr = AtomicPtr::new(ptr);
    ///
    /// let new: *mut _ = &mut 10;
    /// assert_eq!(some_ptr.try_update(Ordering::SeqCst, Ordering::SeqCst, |_| None), Err(ptr));
    /// let result = some_ptr.try_update(Ordering::SeqCst, Ordering::SeqCst, |x| {
    ///     if x == ptr {
    ///         Some(new)
    ///     } else {
    ///         None
    ///     }
    /// });
    /// assert_eq!(result, Ok(ptr));
    /// assert_eq!(some_ptr.load(Ordering::SeqCst), new);
    /// ```
    #[inline]
    #[stable(feature = "atomic_try_update", since = "1.95.0")]
    #[cfg(target_has_atomic = "ptr")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub fn try_update(
        &self,
        set_order: Ordering,
        fetch_order: Ordering,
        mut f: impl FnMut(*mut T) -> Option<*mut T>,
    ) -> Result<*mut T, *mut T> {
        let mut prev = self.load(fetch_order);
        while let Some(next) = f(prev) {
            match self.compare_exchange_weak(prev, next, set_order, fetch_order) {
                x @ Ok(_) => return x,
                Err(next_prev) => prev = next_prev,
            }
        }
        Err(prev)
    }

    /// 新值被存储，旧值被返回。
    /// The new value is stored and the old value is returned.
    ///
    /// See also: [`try_update`](`AtomicPtr::try_update`).
    ///
    /// Note: This may call the function multiple times if the value has been changed from other threads in
    /// the meantime, but the function will have been applied only once to the stored value.
    ///
    /// `update` takes two [`Ordering`] arguments to describe the memory
    /// ordering of this operation. The first describes the required ordering for
    /// **注意：**此方法仅在支持原子操作的平台上可用。
    /// required ordering for loads. These correspond to the success and failure
    /// orderings of [`AtomicPtr::compare_exchange`] respectively.
    ///
    /// Using [`Acquire`] as success ordering makes the store part
    /// of this operation [`Relaxed`], and using [`Release`] makes the final successful load
    /// [`Relaxed`]. The (failed) load ordering can only be [`SeqCst`], [`Acquire`] or [`Relaxed`].
    ///
    /// **注意：** 此方法仅在支持原子操作的平台上可用。
    /// 对指针进行操作。
    ///
    /// # 注意事项
    ///
    /// 此方法并非魔法，不是由硬件提供的，也不像
    /// 关键区域或互斥锁那样工作。
    ///
    /// 它是基于原子[比较与交换操作]实现的，因此存在
    /// CAS 操作的常见缺点。特别是要小心[ABA问题]，
    /// 这是指针特别常见的陷阱！
    ///
    /// [ABA Problem]: https://en.wikipedia.org/wiki/ABA_problem
    /// [compare-and-swap operation]: https://en.wikipedia.org/wiki/Compare-and-swap
    ///
    /// # 示例
    ///
    /// ```rust
    ///
    /// use std::sync::atomic::{AtomicPtr, Ordering};
    ///
    /// let ptr: *mut _ = &mut 5;
    /// let some_ptr = AtomicPtr::new(ptr);
    ///
    /// let new: *mut _ = &mut 10;
    /// let result = some_ptr.update(Ordering::SeqCst, Ordering::SeqCst, |_| new);
    /// assert_eq!(result, ptr);
    /// assert_eq!(some_ptr.load(Ordering::SeqCst), new);
    /// ```
    #[inline]
    #[stable(feature = "atomic_try_update", since = "1.95.0")]
    #[cfg(target_has_atomic = "ptr")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub fn update(
        &self,
        set_order: Ordering,
        fetch_order: Ordering,
        mut f: impl FnMut(*mut T) -> *mut T,
    ) -> *mut T {
        let mut prev = self.load(fetch_order);
        loop {
            match self.compare_exchange_weak(prev, f(prev), set_order, fetch_order) {
                Ok(x) => break x,
                Err(next_prev) => prev = next_prev,
            }
        }
    }

    /// Offsets the pointer's address by adding `val` (in units of `T`),
    /// 返回之前的指针。
    ///
    /// This is equivalent to using [`wrapping_add`] to atomically perform the
    /// equivalent of `ptr = ptr.wrapping_add(val);`.
    ///
    /// This method operates in units of `T`, which means that it cannot be used
    /// to offset the pointer by an amount which is not a multiple of
    /// `size_of::<T>()`. This can sometimes be inconvenient, as you may want to
    /// work with a deliberately misaligned pointer. In such cases, you may use
    /// the [`fetch_byte_add`](Self::fetch_byte_add) method instead.
    ///
    /// `fetch_ptr_add` takes an [`Ordering`] argument which describes the
    /// memory ordering of this operation. All ordering modes are possible. Note
    /// that using [`Acquire`] makes the store part of this operation
    /// [`Relaxed`], and using [`Release`] makes the load part [`Relaxed`].
    ///
    /// # 示例
    /// operations on [`AtomicPtr`].
    ///
    /// [`wrapping_add`]: pointer::wrapping_add
    ///
    /// # 返回之前的指针。
    ///
    /// ```
    /// use core::sync::atomic::{AtomicPtr, Ordering};
    ///
    /// let atom = AtomicPtr::<i64>::new(core::ptr::null_mut());
    /// assert_eq!(atom.fetch_ptr_add(1, Ordering::Relaxed).addr(), 0);
    /// // Note: units of `size_of::<i64>()`.
    /// assert_eq!(atom.load(Ordering::Relaxed).addr(), 8);
    /// ```
    #[inline]
    #[cfg(target_has_atomic = "ptr")]
    #[stable(feature = "strict_provenance_atomic_ptr", since = "1.91.0")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub fn fetch_ptr_add(&self, val: usize, order: Ordering) -> *mut T {
        self.fetch_byte_add(val.wrapping_mul(size_of::<T>()), order)
    }

    /// Offsets the pointer's address by subtracting `val` (in units of `T`),
    /// returning the previous pointer.
    ///
    /// This is equivalent to using [`wrapping_sub`] to atomically perform the
    /// equivalent of `ptr = ptr.wrapping_sub(val);`.
    ///
    /// This method operates in units of `T`, which means that it cannot be used
    /// to offset the pointer by an amount which is not a multiple of
    /// `size_of::<T>()`. This can sometimes be inconvenient, as you may want to
    /// 处理故意错位指针。在这种情况下，可以使用
    /// the [`fetch_byte_sub`](Self::fetch_byte_sub) method instead.
    ///
    /// `fetch_ptr_sub` takes an [`Ordering`] argument which describes the memory
    /// ordering of this operation. All ordering modes are possible. Note that
    /// using [`Acquire`] makes the store part of this operation [`Relaxed`],
    /// and using [`Release`] makes the load part [`Relaxed`].
    ///
    /// 处理故意错位指针。在这种情况下，可以使用
    /// operations on [`AtomicPtr`].
    ///
    /// [`wrapping_sub`]: pointer::wrapping_sub
    ///
    /// # 示例
    ///
    /// ```
    /// use core::sync::atomic::{AtomicPtr, Ordering};
    ///
    /// let array = [1i32, 2i32];
    /// let atom = AtomicPtr::new(array.as_ptr().wrapping_add(1) as *mut _);
    ///
    /// assert!(core::ptr::eq(
    ///     atom.fetch_ptr_sub(1, Ordering::Relaxed),
    ///     &array[1],
    /// ));
    /// assert!(core::ptr::eq(atom.load(Ordering::Relaxed), &array[0]));
    /// ```
    #[inline]
    #[cfg(target_has_atomic = "ptr")]
    #[stable(feature = "strict_provenance_atomic_ptr", since = "1.91.0")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub fn fetch_ptr_sub(&self, val: usize, order: Ordering) -> *mut T {
        self.fetch_byte_sub(val.wrapping_mul(size_of::<T>()), order)
    }

    /// Offsets the pointer's address by adding `val` *bytes*, returning the
    /// 之前的指针。
    ///
    /// This is equivalent to using [`wrapping_byte_add`] to atomically
    /// perform `ptr = ptr.wrapping_byte_add(val)`.
    ///
    /// `fetch_byte_add` takes an [`Ordering`] argument which describes the
    /// 此操作的内存排序方式。所有排序模式都是可能的。注意
    /// that using [`Acquire`] makes the store part of this operation
    /// [`Relaxed`], and using [`Release`] makes the load part [`Relaxed`].
    ///
    /// **Note**: This method is only available on platforms that support atomic
    /// operations on [`AtomicPtr`].
    ///
    /// [`wrapping_byte_add`]: pointer::wrapping_byte_add
    ///
    /// # 示例
    ///
    /// ```
    /// use core::sync::atomic::{AtomicPtr, Ordering};
    ///
    /// let atom = AtomicPtr::<i64>::new(core::ptr::null_mut());
    /// assert_eq!(atom.fetch_byte_add(1, Ordering::Relaxed).addr(), 0);
    /// // Note: in units of bytes, not `size_of::<i64>()`.
    /// assert_eq!(atom.load(Ordering::Relaxed).addr(), 1);
    /// ```
    #[inline]
    #[cfg(target_has_atomic = "ptr")]
    #[stable(feature = "strict_provenance_atomic_ptr", since = "1.91.0")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub fn fetch_byte_add(&self, val: usize, order: Ordering) -> *mut T {
        // SAFETY: data races are prevented by atomic intrinsics.
        unsafe { atomic_add(self.as_ptr(), val, order).cast() }
    }

    /// Offsets the pointer's address by subtracting `val` *bytes*, returning the
    /// previous pointer.
    ///
    /// This is equivalent to using [`wrapping_byte_sub`] to atomically
    /// perform `ptr = ptr.wrapping_byte_sub(val)`.
    ///
    /// `fetch_byte_sub` takes an [`Ordering`] argument which describes the
    /// memory ordering of this operation. All ordering modes are possible. Note
    /// that using [`Acquire`] makes the store part of this operation
    /// [`Relaxed`], and using [`Release`] makes the load part [`Relaxed`].
    ///
    /// **Note**: This method is only available on platforms that support atomic
    /// operations on [`AtomicPtr`].
    ///
    /// [`wrapping_byte_sub`]: pointer::wrapping_byte_sub
    ///
    /// # 示例
    ///
    /// ```
    /// use core::sync::atomic::{AtomicPtr, Ordering};
    ///
    /// let mut arr = [0i64, 1];
    /// let atom = AtomicPtr::<i64>::new(&raw mut arr[1]);
    /// assert_eq!(atom.fetch_byte_sub(8, Ordering::Relaxed).addr(), (&raw const arr[1]).addr());
    /// assert_eq!(atom.load(Ordering::Relaxed).addr(), (&raw const arr[0]).addr());
    /// ```
    #[inline]
    #[cfg(target_has_atomic = "ptr")]
    #[stable(feature = "strict_provenance_atomic_ptr", since = "1.91.0")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub fn fetch_byte_sub(&self, val: usize, order: Ordering) -> *mut T {
        // SAFETY: data races are prevented by atomic intrinsics.
        unsafe { atomic_sub(self.as_ptr(), val, order).cast() }
    }

    /// 对当前指针的地址执行位“或”操作，
    /// and the argument `val`, and stores a pointer with provenance of the
    /// current pointer and the resulting address.
    ///
    /// This is equivalent to using [`map_addr`] to atomically perform
    /// `ptr = ptr.map_addr(|a| a | val)`. This can be used in tagged
    /// pointer schemes to atomically set tag bits.
    ///
    /// **注意事项**：此操作返回之前的值。为了在不丢失来源信息的情况下计算
    /// stored value without losing provenance, you may use [`map_addr`]. For
    /// example: `a.fetch_or(val).map_addr(|a| a | val)`.
    ///
    /// `fetch_or` takes an [`Ordering`] argument which describes the memory
    /// ordering of this operation. All ordering modes are possible. Note that
    /// using [`Acquire`] makes the store part of this operation [`Relaxed`],
    /// and using [`Release`] makes the load part [`Relaxed`].
    ///
    /// **Note**: This method is only available on platforms that support atomic
    /// operations on [`AtomicPtr`].
    ///
    /// 此 API 及其声称的语义是 Strict Provenance
    /// experiment, see the [module documentation for `ptr`][crate::ptr] for
    /// details.
    ///
    /// [`map_addr`]: pointer::map_addr
    ///
    /// # 示例
    ///
    /// ```
    /// use core::sync::atomic::{AtomicPtr, Ordering};
    ///
    /// let pointer = &mut 3i64 as *mut i64;
    ///
    /// let atom = AtomicPtr::<i64>::new(pointer);
    /// // Tag the bottom bit of the pointer.
    /// assert_eq!(atom.fetch_or(1, Ordering::Relaxed).addr() & 1, 0);
    /// // Extract and untag.
    /// let tagged = atom.load(Ordering::Relaxed);
    /// assert_eq!(tagged.addr() & 1, 1);
    /// assert_eq!(tagged.map_addr(|p| p & !1), pointer);
    /// ```
    #[inline]
    #[cfg(target_has_atomic = "ptr")]
    #[stable(feature = "strict_provenance_atomic_ptr", since = "1.91.0")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub fn fetch_or(&self, val: usize, order: Ordering) -> *mut T {
        // SAFETY: data races are prevented by atomic intrinsics.
        unsafe { atomic_or(self.as_ptr(), val, order).cast() }
    }

    /// Performs a bitwise "and" operation on the address of the current
    /// pointer, and the argument `val`, and stores a pointer with provenance of
    /// the current pointer and the resulting address.
    ///
    /// This is equivalent to using [`map_addr`] to atomically perform
    /// `ptr = ptr.map_addr(|a| a & val)`. This can be used in tagged
    /// 指向原子未置位标签位的指针方案。
    ///
    /// **注意**：此操作返回之前的值。为了计算
    /// stored value without losing provenance, you may use [`map_addr`]. For
    /// example: `a.fetch_and(val).map_addr(|a| a & val)`.
    ///
    /// `fetch_and` takes an [`Ordering`] argument which describes the memory
    /// ordering of this operation. All ordering modes are possible. Note that
    /// using [`Acquire`] makes the store part of this operation [`Relaxed`],
    /// and using [`Release`] makes the load part [`Relaxed`].
    ///
    /// **Note**: This method is only available on platforms that support atomic
    /// operations on [`AtomicPtr`].
    ///
    /// This API and its claimed semantics are part of the Strict Provenance
    /// experiment, see the [module documentation for `ptr`][crate::ptr] for
    /// details.
    ///
    /// [`map_addr`]: pointer::map_addr
    ///
    /// # 指针方案以原子地切换标签位。
    ///
    /// ```
    /// use core::sync::atomic::{AtomicPtr, Ordering};
    ///
    /// let pointer = &mut 3i64 as *mut i64;
    /// // A tagged pointer
    /// let atom = AtomicPtr::<i64>::new(pointer.map_addr(|a| a | 1));
    /// assert_eq!(atom.fetch_or(1, Ordering::Relaxed).addr() & 1, 1);
    /// // Untag, and extract the previously tagged pointer.
    /// let untagged = atom.fetch_and(!1, Ordering::Relaxed)
    ///     .map_addr(|a| a & !1);
    /// assert_eq!(untagged, pointer);
    /// ```
    #[inline]
    #[cfg(target_has_atomic = "ptr")]
    #[stable(feature = "strict_provenance_atomic_ptr", since = "1.91.0")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub fn fetch_and(&self, val: usize, order: Ordering) -> *mut T {
        // SAFETY: data races are prevented by atomic intrinsics.
        unsafe { atomic_and(self.as_ptr(), val, order).cast() }
    }

    /// **注意**：此操作返回之前的值。为了计算
    /// pointer, and the argument `val`, and stores a pointer with provenance of
    /// the current pointer and the resulting address.
    ///
    /// This is equivalent to using [`map_addr`] to atomically perform
    /// `ptr = ptr.map_addr(|a| a ^ val)`. This can be used in tagged
    /// 指针方案以原子地切换标签位。
    ///
    /// **注意**：此操作返回之前的值。为了计算
    /// stored value without losing provenance, you may use [`map_addr`]. For
    /// example: `a.fetch_xor(val).map_addr(|a| a ^ val)`.
    ///
    /// `fetch_xor` takes an [`Ordering`] argument which describes the memory
    /// 内存排序顺序。所有排序模式都是可能的。请注意，
    /// using [`Acquire`] makes the store part of this operation [`Relaxed`],
    /// and using [`Release`] makes the load part [`Relaxed`].
    ///
    /// **Note**: This method is only available on platforms that support atomic
    /// operations on [`AtomicPtr`].
    ///
    /// This API and its claimed semantics are part of the Strict Provenance
    /// experiment, see the [module documentation for `ptr`][crate::ptr] for
    /// 详情。
    ///
    /// [`map_addr`]: pointer::map_addr
    ///
    /// # 示例
    ///
    /// ```
    /// use core::sync::atomic::{AtomicPtr, Ordering};
    ///
    /// let pointer = &mut 3i64 as *mut i64;
    /// let atom = AtomicPtr::<i64>::new(pointer);
    ///
    /// // Toggle a tag bit on the pointer.
    /// atom.fetch_xor(1, Ordering::Relaxed);
    /// assert_eq!(atom.load(Ordering::Relaxed).addr() & 1, 1);
    /// ```
    #[inline]
    #[cfg(target_has_atomic = "ptr")]
    #[stable(feature = "strict_provenance_atomic_ptr", since = "1.91.0")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    #[lint::should_not_be_called_on_const_items]
    pub fn fetch_xor(&self, val: usize, order: Ordering) -> *mut T {
        // SAFETY: data races are prevented by atomic intrinsics.
        unsafe { atomic_xor(self.as_ptr(), val, order).cast() }
    }

    /// 返回指向底层指针的可变指针。
    ///
    /// 对结果指针进行非原子读取和写入可能导致数据竞争。
    /// 此方法主要用于 FFI，其中函数签名可能使用
    /// `*mut *mut T` instead of `&AtomicPtr<T>`.
    ///
    /// Returning an `*mut` pointer from a shared reference to this atomic is safe because the
    /// 原子类型支持内部可变性。所有对原子的修改都通过共享引用改变值，
    /// 只要使用原子操作，就可以安全地进行。任何
    /// use of the returned raw pointer requires an `unsafe` block and still has to uphold the
    /// [内存模型] 的要求。
    ///
    /// # 示例
    ///
    /// ```ignore (extern-declaration)
    /// use std::sync::atomic::AtomicPtr;
    ///
    /// extern "C" {
    ///     fn my_atomic_op(arg: *mut *mut u32);
    /// }
    ///
    /// let mut value = 17;
    /// let atomic = AtomicPtr::new(&mut value);
    ///
    /// // SAFETY: Safe as long as `my_atomic_op` is atomic.
    /// unsafe {
    ///     my_atomic_op(atomic.as_ptr());
    /// }
    /// ```
    ///
    /// [memory model]: self#memory-model-for-atomic-accesses
    #[inline]
    #[stable(feature = "atomic_as_ptr", since = "1.70.0")]
    #[rustc_const_stable(feature = "atomic_as_ptr", since = "1.70.0")]
    #[lint::never_returns_null_ptr]
    pub const fn as_ptr(&self) -> *mut *mut T {
        self.v.get().cast()
    }
}

#[cfg(target_has_atomic_load_store = "8")]
#[stable(feature = "atomic_bool_from", since = "1.24.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl From<bool> for AtomicBool {
    /// Converts a `bool` into an `AtomicBool`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::sync::atomic::AtomicBool;
    /// let atomic_bool = AtomicBool::from(true);
    /// assert_eq!(format!("{atomic_bool:?}"), "true")
    /// ```
    #[inline]
    fn from(b: bool) -> Self {
        Self::new(b)
    }
}

#[cfg(target_has_atomic_load_store = "ptr")]
#[stable(feature = "atomic_from", since = "1.23.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl<T> From<*mut T> for AtomicPtr<T> {
    /// Converts a `*mut T` into an `AtomicPtr<T>`.
    #[inline]
    fn from(p: *mut T) -> Self {
        Self::new(p)
    }
}

#[allow(unused_macros)] // This macro ends up being unused on some architectures.
macro_rules! if_8_bit {
    (u8, $( yes = [$($yes:tt)*], )? $( no = [$($no:tt)*], )? ) => { concat!("", $($($yes)*)?) };
    (i8, $( yes = [$($yes:tt)*], )? $( no = [$($no:tt)*], )? ) => { concat!("", $($($yes)*)?) };
    ($_:ident, $( yes = [$($yes:tt)*], )? $( no = [$($no:tt)*], )? ) => { concat!("", $($($no)*)?) };
}

#[cfg(target_has_atomic_load_store)]
macro_rules! atomic_int {
    ($cfg_base:meta,
     $cfg_cas:meta,
     $cfg_align:meta,
     $stable:meta,
     $stable_cxchg:meta,
     $stable_debug:meta,
     $stable_access:meta,
     $stable_from:meta,
     $stable_nand:meta,
     $const_stable_new:meta,
     $const_stable_into_inner:meta,
     $s_int_type:literal,
     $extra_feature:expr,
     $min_fn:ident, $max_fn:ident,
     $align:expr,
     $int_type:ident $atomic_type:ident) => {
        /// 一种可以在线程之间安全共享的整数类型。
        ///
        /// 此类型的特性与底层整数类型相同。
        #[doc = if_8_bit!(
            $int_type,
            yes = ["size, alignment, and bit validity"],
            no = ["size and bit validity"],
        )]
        /// 与底层整数类型相同。
        #[doc = $s_int_type]
        /// `].
        #[doc = if_8_bit! {
            $int_type,
            no = [
                "However, the alignment of this type is always equal to its ",
                "size, even on targets where [`", $s_int_type, "`] has a ",
                "lesser alignment."
            ],
        }]
        ///
        /// 关于原子类型与非原子类型之间的区别，以及此类型的可移植性信息，请参阅[模块级文档]。
        /// **注意：** 此类型仅支持支持
        /// 原子加载和存储的平台。
        ///
        /// 从指针创建一个新的原子整数。
        /// # 示例
        #[doc = $s_int_type]
        /// `].
        ///
        /// [module-level documentation]: crate::sync::atomic
        #[$stable]
        pub type $atomic_type = Atomic<$int_type>;

        #[$stable]
        impl Default for $atomic_type {
            #[inline]
            fn default() -> Self {
                Self::new(Default::default())
            }
        }

        #[$stable_from]
        #[rustc_const_unstable(feature = "const_convert", issue = "143773")]
        const impl From<$int_type> for $atomic_type {
            #[doc = concat!("Converts an `", stringify!($int_type), "` into an `", stringify!($atomic_type), "`.")]
            #[inline]
            fn from(v: $int_type) -> Self { Self::new(v) }
        }

        #[$stable_debug]
        impl fmt::Debug for $atomic_type {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                fmt::Debug::fmt(&self.load(Ordering::Relaxed), f)
            }
        }

        impl $atomic_type {
            /// # 安全性
            ///
            /// # Examples
            ///
            #[cfg_attr($cfg_base, doc = "```")]
            #[cfg_attr(not($cfg_base), doc = "```compile_fail")]
            #[doc = concat!($extra_feature, "use std::sync::atomic::", stringify!($atomic_type), ";")]
            ///
            #[doc = concat!("let atomic_forty_two = ", stringify!($atomic_type), "::new(42);")]
            /// ```
            #[inline]
            #[$stable]
            #[$const_stable_new]
            #[must_use]
            pub const fn new(v: $int_type) -> Self {
                // SAFETY:
                // `Atomic<T>` is essentially a transparent wrapper around `T`.
                unsafe { transmute(v) }
            }

            /// Creates a new reference to an atomic integer from a pointer.
            ///
            /// # Examples
            ///
            #[cfg_attr($cfg_base, doc = "```rust")]
            #[cfg_attr(not($cfg_base), doc = "```rust,compile_fail")]
            #[doc = concat!($extra_feature, "use std::sync::atomic::{self, ", stringify!($atomic_type), "};")]
            ///
            /// // Get a pointer to an allocated value
            #[doc = concat!("let ptr: *mut ", stringify!($int_type), " = Box::into_raw(Box::new(0));")]
            ///
            #[doc = concat!("assert!(ptr.cast::<", stringify!($atomic_type), ">().is_aligned());")]
            ///
            /// {
            ///     // Create an atomic view of the allocated value
            // SAFETY: this is a doc comment, tidy, it can't hurt you (also guaranteed by the construction of `ptr` and the assert above)
            #[doc = concat!("    let atomic = unsafe {", stringify!($atomic_type), "::from_ptr(ptr) };")]
            ///
            ///     // Use `atomic` for atomic operations, possibly share it with other threads
            ///     atomic.store(1, atomic::Ordering::Relaxed);
            /// }
            ///
            /// // It's ok to non-atomically access the value behind `ptr`,
            /// // since the reference to the atomic ended its lifetime in the block above
            /// assert_eq!(unsafe { *ptr }, 1);
            ///
            /// // Deallocate the value
            /// unsafe { drop(Box::from_raw(ptr)) }
            /// ```
            ///
            /// # Safety
            ///
            /// * `ptr` must be aligned to
            #[doc = concat!("  `align_of::<", stringify!($atomic_type), ">()`")]
            #[doc = if_8_bit!{
                $int_type,
                yes = [
                    "  (note that this is always true, since `align_of::<",
                    stringify!($atomic_type), ">() == 1`)."
                ],
                no = [
                    "  (note that on some platforms this can be bigger than `align_of::<",
                    stringify!($int_type), ">()`)."
                ],
            }]
            /// * `ptr` must be [valid] for both reads and writes for the whole lifetime `'a`.
            /// 如果你想要进行易失性原子访问，从而避免创建对目标值的引用，这非常有用。
            /// 
            /// 此方法返回一个可变的底层整数引用。
            ///
            /// [valid]: crate::ptr#safety
            /// [Memory model for atomic accesses]: self#memory-model-for-atomic-accesses
            #[inline]
            #[stable(feature = "atomic_from_ptr", since = "1.75.0")]
            #[rustc_const_stable(feature = "const_atomic_from_ptr", since = "1.84.0")]
            pub const unsafe fn from_ptr<'a>(ptr: *mut $int_type) -> &'a $atomic_type {
                // SAFETY: guaranteed by the caller
                unsafe { &*ptr.cast() }
            }

            /// 由于可变引用确保没有其他线程同时访问原子数据，因此这是安全的。
            ///
            /// # 示例
            /// assert_eq!(*some_var.get_mut(), 10);
            #[inline]
            #[unstable(feature = "atomic_volatile", issue = "158947")]
            pub const fn from_ptr_raw(ptr: *mut $int_type) -> *const $atomic_type {
                ptr.cast_const().cast()
            }

            /// *some_var.get_mut() = 5;
            ///
            /// assert_eq!(some_var.load(Ordering::SeqCst), 5);
            /// 由于可变引用确保没有其他线程同时访问原子数据，因此这是安全的。
            ///
            /// # 示例
            ///
            #[cfg_attr($cfg_base, doc = "```")]
            #[cfg_attr(not($cfg_base), doc = "```compile_fail")]
            #[doc = concat!($extra_feature, "use std::sync::atomic::{", stringify!($atomic_type), ", Ordering};")]
            ///
            #[doc = concat!("let mut some_var = ", stringify!($atomic_type), "::new(10);")]
            /// assert_eq!(view, [0; 10]);
            /// view
            /// .iter_mut()
            /// ```
            #[inline]
            #[$stable_access]
            #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
            pub const fn get_mut(&mut self) -> &mut $int_type {
                // SAFETY:
                // `Atomic<T>` is essentially a transparent wrapper around `T`.
                unsafe { &mut *self.as_ptr() }
            }

            #[doc = concat!("Get atomic access to a `&mut ", stringify!($int_type), "`.")]
            ///
            #[doc = if_8_bit! {
                $int_type,
                no = [
                    "**Note:** This function is only available on targets where `",
                    stringify!($atomic_type), "` has the same alignment as `", stringify!($int_type), "`."
                ],
            }]
            ///
            /// # Examples
            ///
            #[cfg_attr($cfg_align, doc = "```rust")]
            #[cfg_attr(not($cfg_align), doc = "```rust,compile_fail")]
            #[doc = concat!($extra_feature, "use std::sync::atomic::{", stringify!($atomic_type), ", Ordering};")]
            ///
            /// let mut some_int = 123;
            #[doc = concat!("let a = ", stringify!($atomic_type), "::from_mut(&mut some_int);")]
            /// a.store(100, Ordering::Relaxed);
            /// assert_eq!(some_int, 100);
            /// ```
            ///
            #[inline]
            #[cfg(any($cfg_align, doc))]
            #[stable(feature = "atomic_from_mut", since = "1.98.0")]
            #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
            pub const fn from_mut(v: &mut $int_type) -> &mut Self {
                let [] = [(); align_of::<Self>() - align_of::<$int_type>()];
                // SAFETY:
                //  - the mutable reference guarantees unique ownership.
                //  - the alignment of `$int_type` and `Self` is the
                //    same, as promised by $cfg_align and verified above.
                unsafe { &mut *(v as *mut $int_type as *mut Self) }
            }

            #[doc = concat!("Get non-atomic access to a `&mut [", stringify!($atomic_type), "]` slice")]
            ///
            /// .enumerate()
            /// .for_each(|(idx, int)| *int = idx as _);
            ///
            /// # std::thread::scope(|s| {
            ///
            #[cfg_attr($cfg_base, doc = "```ignore-wasm")]
            #[cfg_attr(not($cfg_base), doc = "```ignore-wasm,compile_fail")]
            #[doc = concat!($extra_feature, "use std::sync::atomic::{", stringify!($atomic_type), ", Ordering};")]
            ///
            #[doc = concat!("let mut some_ints = [const { ", stringify!($atomic_type), "::new(0) }; 10];")]
            ///
            #[doc = concat!("let view: &mut [", stringify!($int_type), "] = ", stringify!($atomic_type), "::get_mut_slice(&mut some_ints);")]
            /// some_ints
            /// .iter()
            /// .enumerate()
            /// .for_each(|(idx, int)| {
            /// s.spawn(move || assert_eq!(int.load(Ordering::Relaxed), idx as _));
            ///
            /// Consumes原子数据并返回其包含的值。
            ///     some_ints
            ///         .iter()
            /// # 安全性
            /// 如果违反以下任何条件，其行为将未定义：
            /// s.spawn(move || assert_eq!(int.load(Ordering::Relaxed), idx as _));
            ///         })
            /// });
            /// ```
            #[inline]
            #[stable(feature = "atomic_from_mut", since = "1.98.0")]
            #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
            pub const fn get_mut_slice(this: &mut [Self]) -> &mut [$int_type] {
                // SAFETY: the mutable reference guarantees unique ownership.
                unsafe { &mut *(this as *mut [Self] as *mut [$int_type]) }
            }

            #[doc = concat!("Get atomic access to a `&mut [", stringify!($int_type), "]` slice.")]
            ///
            #[doc = if_8_bit! {
                $int_type,
                no = [
                    "**Note:** This function is only available on targets where `",
                    stringify!($atomic_type), "` has the same alignment as `", stringify!($int_type), "`."
                ],
            }]
            ///
            /// # Examples
            ///
            #[cfg_attr($cfg_align, doc = "```ignore-wasm")]
            #[cfg_attr(not($cfg_align), doc = "```ignore-wasm,compile_fail")]
            #[doc = concat!($extra_feature, "use std::sync::atomic::{", stringify!($atomic_type), ", Ordering};")]
            ///
            /// let mut some_ints = [0; 10];
            #[doc = concat!("let a = &*", stringify!($atomic_type), "::from_mut_slice(&mut some_ints);")]
            /// std::thread::scope(|s| {
            ///     for i in 0..a.len() {
            ///         s.spawn(move || a[i].store(i as _, Ordering::Relaxed));
            ///     }
            /// });
            /// for (i, n) in some_ints.into_iter().enumerate() {
            ///     assert_eq!(i, n as usize);
            /// }
            /// ```
            #[inline]
            #[cfg(any($cfg_align, doc))]
            #[stable(feature = "atomic_from_mut", since = "1.98.0")]
            #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
            pub const fn from_mut_slice(v: &mut [$int_type]) -> &mut [Self] {
                let [] = [(); align_of::<Self>() - align_of::<$int_type>()];
                // SAFETY:
                //  - the mutable reference guarantees unique ownership.
                //  - the alignment of `$int_type` and `Self` is the
                //    same, as promised by $cfg_align and verified above.
                unsafe { &mut *(v as *mut [$int_type] as *mut [Self]) }
            }

            /// Consumes the atomic and returns the contained value.
            ///
            /// This is safe because passing `self` by value guarantees that no other threads are
            /// concurrently accessing the atomic data.
            ///
            /// # Examples
            ///
            #[cfg_attr($cfg_base, doc = "```")]
            #[cfg_attr(not($cfg_base), doc = "```compile_fail")]
            #[doc = concat!($extra_feature, "use std::sync::atomic::", stringify!($atomic_type), ";")]
            ///
            #[doc = concat!("let some_var = ", stringify!($atomic_type), "::new(5);")]
            /// assert_eq!(some_var.into_inner(), 5);
            /// ```
            #[inline]
            #[$stable_access]
            #[$const_stable_into_inner]
            pub const fn into_inner(self) -> $int_type {
                // SAFETY:
                // `Atomic<T>` is essentially a transparent wrapper around `T`.
                unsafe { transmute(self) }
            }

            /// Loads a value from the atomic integer.
            ///
            /// `load` takes an [`Ordering`] argument which describes the memory ordering of this operation.
            /// Possible values are [`SeqCst`], [`Acquire`] and [`Relaxed`].
            ///
            /// # Panics
            ///
            /// Panics if `order` is [`Release`] or [`AcqRel`].
            ///
            /// # Examples
            ///
            #[cfg_attr($cfg_base, doc = "```")]
            #[cfg_attr(not($cfg_base), doc = "```compile_fail")]
            #[doc = concat!($extra_feature, "use std::sync::atomic::{", stringify!($atomic_type), ", Ordering};")]
            ///
            #[doc = concat!("let some_var = ", stringify!($atomic_type), "::new(5);")]
            ///
            /// assert_eq!(some_var.load(Ordering::Relaxed), 5);
            /// ```
            #[inline]
            #[$stable]
            #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
            #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
            pub const fn load(&self, order: Ordering) -> $int_type {
                // SAFETY: data races are prevented by atomic intrinsics.
                unsafe { atomic_load::<_, /* VOLATILE */ false>(self.as_ptr(), order) }
            }

            /// Perform a volatile load from the atomic integer.
            ///
            /// `load_volatile` takes an [`Ordering`] argument which describes the memory ordering
            /// of this operation. Possible values are [`SeqCst`], [`Acquire`] and [`Relaxed`].
            ///
            #[doc = include_str!("./atomic_load_volatile.md")]
            ///
            /// # Safety
            ///
            /// Behavior is undefined if any of the following conditions are violated:
            ///
            /// * `self` must be [valid] for reads, or `self` must point to memory
            /// 所有 Rust 分配之外的操作以及从该内存读取的内容必须：
            /// - 不引发 panic，并且
            /// - 不会修改 Rust 分配内的任何内存。
            ///
            /// * `self` must be aligned to
            #[doc = concat!("  `align_of::<", stringify!($atomic_type), ">()`")]
            #[doc = if_8_bit!{
                $int_type,
                yes = [
                    "  (note that this is always true, since `align_of::<",
                    stringify!($atomic_type), ">() == 1`)."
                ],
                no = [
                    "  (note that on some platforms this can be bigger than `align_of::<",
                    stringify!($int_type), ">()`)."
                ],
            }]
            ///
            /// * Reading from `self` must produce a properly initialized value of the underlying
            /// 整数类型的正确初始化值。
            ///
            /// [valid]: core::ptr#safety
            ///
            /// # Panics
            ///
            /// Panics if `order` is [`Release`] or [`AcqRel`].
            #[inline]
            #[unstable(feature = "atomic_volatile", issue = "158947")]
            #[rustc_const_unstable(feature = "atomic_volatile", issue = "158947")]
            #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
            pub const unsafe fn load_volatile(self: *const Self, order: Ordering) -> $int_type {
                // SAFETY: follows from our own safety requirements.
                unsafe {
                    atomic_load::<_, /* VOLATILE */ true>(self.cast::<$int_type>(), order)
                }
            }

            /// 将值存储到原子整数中。
            ///
            /// `store` takes an [`Ordering`] argument which describes the memory ordering of this operation.
            ///  Possible values are [`SeqCst`], [`Release`] and [`Relaxed`].
            ///
            /// # Panics
            ///
            /// Panics if `order` is [`Acquire`] or [`AcqRel`].
            ///
            /// # 示例
            ///
            #[cfg_attr($cfg_base, doc = "```")]
            #[cfg_attr(not($cfg_base), doc = "```compile_fail")]
            #[doc = concat!($extra_feature, "use std::sync::atomic::{", stringify!($atomic_type), ", Ordering};")]
            ///
            #[doc = concat!("let some_var = ", stringify!($atomic_type), "::new(5);")]
            ///
            /// some_var.store(10, Ordering::Relaxed);
            /// assert_eq!(some_var.load(Ordering::Relaxed), 10);
            /// ```
            #[inline]
            #[$stable]
            #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
            #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
            #[lint::should_not_be_called_on_const_items]
            pub const fn store(&self, val: $int_type, order: Ordering) {
                // SAFETY: data races are prevented by atomic intrinsics.
                unsafe { atomic_store::<_, /* VOLATILE */ false>(self.as_ptr(), val, order); }
            }

            /// Performs a volatile store into the atomic integer.
            ///
            /// `store_volatile` takes an [`Ordering`] argument which describes the memory ordering
            /// of this operation. Possible values are [`SeqCst`], [`Release`] and [`Relaxed`].
            ///
            #[doc = include_str!("./atomic_store_volatile.md")]
            ///
            /// # Safety
            ///
            /// Behavior is undefined if any of the following conditions are violated:
            ///
            /// * `self` must be either [valid] for writes, or `self` must point to memory
            ///   outside of all Rust allocations and writing to that memory must:
            ///   - not trap, and
            ///   - not cause any memory inside a Rust allocation to be modified.
            ///
            /// * `self` must be aligned to
            #[doc = concat!("  `align_of::<", stringify!($atomic_type), ">()`")]
            #[doc = if_8_bit!{
                $int_type,
                yes = [
                    "  (note that this is always true, since `align_of::<",
                    stringify!($atomic_type), ">() == 1`)."
                ],
                no = [
                    "  (note that on some platforms this can be bigger than `align_of::<",
                    stringify!($int_type), ">()`)."
                ],
            }]
            ///
            /// [valid]: core::ptr#safety
            ///
            /// # Panics
            ///
            /// Panics if `order` is [`Acquire`] or [`AcqRel`].
            #[inline]
            #[unstable(feature = "atomic_volatile", issue = "158947")]
            #[rustc_const_unstable(feature = "atomic_volatile", issue = "158947")]
            #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
            #[lint::should_not_be_called_on_const_items]
            pub const unsafe fn store_volatile(self: *const Self, val: $int_type, order: Ordering) {
                // SAFETY: follows from our own safety requirements.
                unsafe {
                    atomic_store::<_, /* VOLATILE */ true>(self.cast::<$int_type>().cast_mut(), val, order);
                }
            }

            /// Stores a value into the atomic integer, returning the previous value.
            ///
            /// `swap` takes an [`Ordering`] argument which describes the memory ordering
            /// of this operation. All ordering modes are possible. Note that using
            /// [`Acquire`] makes the store part of this operation [`Relaxed`], and
            /// using [`Release`] makes the load part [`Relaxed`].
            ///
            /// **Note**: This method is only available on platforms that support atomic operations on
            #[doc = concat!("[`", $s_int_type, "`].")]
            ///
            /// # Examples
            ///
            #[cfg_attr($cfg_cas, doc = "```")]
            #[cfg_attr(not($cfg_cas), doc = "```compile_fail")]
            #[doc = concat!($extra_feature, "use std::sync::atomic::{", stringify!($atomic_type), ", Ordering};")]
            ///
            #[doc = concat!("let some_var = ", stringify!($atomic_type), "::new(5);")]
            ///
            /// assert_eq!(some_var.swap(10, Ordering::Relaxed), 5);
            /// ```
            #[inline]
            #[$stable]
            #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
            #[cfg(any($cfg_cas, doc))]
            #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
            #[lint::should_not_be_called_on_const_items]
            pub const fn swap(&self, val: $int_type, order: Ordering) -> $int_type {
                // SAFETY: data races are prevented by atomic intrinsics.
                unsafe { atomic_swap(self.as_ptr(), val, order) }
            }

            /// Stores a value into the atomic integer if the current value is the same as
            /// the `current` value.
            ///
            /// The return value is always the previous value. If it is equal to `current`, then the
            /// value was updated.
            ///
            /// `compare_and_swap` also takes an [`Ordering`] argument which describes the memory
            /// ordering of this operation. Notice that even when using [`AcqRel`], the operation
            /// might fail and hence just perform an `Acquire` load, but not have `Release` semantics.
            /// Using [`Acquire`] makes the store part of this operation [`Relaxed`] if it
            /// happens, and using [`Release`] makes the load part [`Relaxed`].
            ///
            /// **注意**：此方法仅在支持原子操作的平台上可用。
            #[doc = concat!("[`", $s_int_type, "`].")]
            ///
            /// # Migrating to `compare_exchange` and `compare_exchange_weak`
            ///
            /// `compare_and_swap` is equivalent to `compare_exchange` with the following mapping for
            /// 内存顺序：
            ///
            /// Original | Success | Failure
            /// -------- | ------- | -------
            /// Relaxed  | Relaxed | Relaxed
            /// Acquire  | Acquire | Acquire
            /// Release  | Release | Relaxed
            /// AcqRel   | AcqRel  | Acquire
            /// SeqCst   | SeqCst  | SeqCst
            ///
            /// `compare_and_swap` and `compare_exchange` also differ in their return type. You can use
            /// `compare_exchange(...).unwrap_or_else(|x| x)` to recover the behavior of `compare_and_swap`,
            /// but in most cases it is more idiomatic to check whether the return value is `Ok` or `Err`
            /// 而不是基于读取的值推断成功与失败。
            ///
            /// During migration, consider whether it makes sense to use `compare_exchange_weak` instead.
            /// `compare_exchange_weak` is allowed to fail spuriously even when the comparison succeeds,
            /// 这允许编译器在比较和交换
            /// 用于循环时生成更好的汇编代码。
            ///
            /// # 示例
            ///
            #[cfg_attr($cfg_cas, doc = "```")]
            #[cfg_attr(not($cfg_cas), doc = "```compile_fail")]
            #[doc = concat!($extra_feature, "use std::sync::atomic::{", stringify!($atomic_type), ", Ordering};")]
            ///
            #[doc = concat!("let some_var = ", stringify!($atomic_type), "::new(5);")]
            ///
            /// assert_eq!(some_var.compare_and_swap(5, 10, Ordering::Relaxed), 5);
            /// assert_eq!(some_var.load(Ordering::Relaxed), 10);
            ///
            /// assert_eq!(some_var.compare_and_swap(6, 12, Ordering::Relaxed), 10);
            /// assert_eq!(some_var.load(Ordering::Relaxed), 10);
            /// ```
            #[inline]
            #[$stable]
            #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
            #[deprecated(
                since = "1.50.0",
                note = "Use `compare_exchange` or `compare_exchange_weak` instead")
            ]
            #[cfg(any($cfg_cas, doc))]
            #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
            #[lint::should_not_be_called_on_const_items]
            pub const fn compare_and_swap(&self,
                                    current: $int_type,
                                    new: $int_type,
                                    order: Ordering) -> $int_type {
                match self.compare_exchange(current,
                                            new,
                                            order,
                                            strongest_failure_ordering(order)) {
                    Ok(x) => x,
                    Err(x) => x,
                }
            }

            /// Stores a value into the atomic integer if the current value is the same as
            /// the `current` value.
            ///
            /// The return value is a result indicating whether the new value was written and
            /// containing the previous value. On success this value is guaranteed to be equal to
            /// `current`.
            ///
            /// `compare_exchange` takes two [`Ordering`] arguments to describe the memory
            /// ordering of this operation. `success` describes the required ordering for the
            /// read-modify-write operation that takes place if the comparison with `current` succeeds.
            /// `failure` describes the required ordering for the load operation that takes place when
            /// the comparison fails. Using [`Acquire`] as success ordering makes the store part
            /// of this operation [`Relaxed`], and using [`Release`] makes the successful load
            /// [`Relaxed`]. The failure ordering can only be [`SeqCst`], [`Acquire`] or [`Relaxed`].
            ///
            /// **Note**: This method is only available on platforms that support atomic operations on
            #[doc = concat!("[`", $s_int_type, "`].")]
            ///
            /// # Examples
            ///
            #[cfg_attr($cfg_cas, doc = "```")]
            #[cfg_attr(not($cfg_cas), doc = "```compile_fail")]
            #[doc = concat!($extra_feature, "use std::sync::atomic::{", stringify!($atomic_type), ", Ordering};")]
            ///
            #[doc = concat!("let some_var = ", stringify!($atomic_type), "::new(5);")]
            ///
            /// assert_eq!(some_var.compare_exchange(5, 10,
            ///                                      Ordering::Acquire,
            ///                                      Ordering::Relaxed),
            ///            Ok(5));
            /// assert_eq!(some_var.load(Ordering::Relaxed), 10);
            ///
            /// assert_eq!(some_var.compare_exchange(6, 12,
            ///                                      Ordering::SeqCst,
            ///                                      Ordering::Acquire),
            ///            Err(10));
            /// assert_eq!(some_var.load(Ordering::Relaxed), 10);
            /// ```
            ///
            /// # 注意事项
            ///
            /// `compare_exchange` is a [compare-and-swap operation] and thus exhibits the usual downsides
            /// CAS 操作的特点。特别是，先加载值然后成功
            /// `compare_exchange` with the previous load *does not ensure* that other threads have not
            /// 在中间更改了值！当 *相等性* 检查用于检查值的 *身份* 时，这通常很重要，但相等性
            /// the `compare_exchange` is being used to check the *identity* of a value, but equality
            /// does not necessarily imply identity. This is a particularly common case for pointers, as
            /// a pointer holding the same address does not imply that the same object exists at that
            /// address! In this case, `compare_exchange` can lead to the [ABA problem].
            ///
            /// [ABA Problem]: https://en.wikipedia.org/wiki/ABA_problem
            /// [compare-and-swap operation]: https://en.wikipedia.org/wiki/Compare-and-swap
            #[inline]
            #[$stable_cxchg]
            #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
            #[cfg(any($cfg_cas, doc))]
            #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
            #[lint::should_not_be_called_on_const_items]
            pub const fn compare_exchange(&self,
                                    current: $int_type,
                                    new: $int_type,
                                    success: Ordering,
                                    failure: Ordering) -> Result<$int_type, $int_type> {
                // SAFETY: data races are prevented by atomic intrinsics.
                unsafe { atomic_compare_exchange(self.as_ptr(), current, new, success, failure) }
            }

            /// Stores a value into the atomic integer if the current value is the same as
            /// the `current` value.
            ///
            #[doc = concat!("Unlike [`", stringify!($atomic_type), "::compare_exchange`],")]
            /// this function is allowed to spuriously fail even
            /// **注意**：此方法仅在支持原子操作的平台上可用
            /// # 示例
            /// let mut old = val.load(Ordering::Relaxed);
            ///
            /// `compare_exchange_weak` takes two [`Ordering`] arguments to describe the memory
            /// ordering of this operation. `success` describes the required ordering for the
            /// read-modify-write operation that takes place if the comparison with `current` succeeds.
            /// `failure` describes the required ordering for the load operation that takes place when
            /// the comparison fails. Using [`Acquire`] as success ordering makes the store part
            /// of this operation [`Relaxed`], and using [`Release`] makes the successful load
            /// [`Relaxed`]. The failure ordering can only be [`SeqCst`], [`Acquire`] or [`Relaxed`].
            ///
            /// **Note**: This method is only available on platforms that support atomic operations on
            #[doc = concat!("[`", $s_int_type, "`].")]
            ///
            /// # Examples
            ///
            #[cfg_attr($cfg_cas, doc = "```")]
            #[cfg_attr(not($cfg_cas), doc = "```compile_fail")]
            #[doc = concat!($extra_feature, "use std::sync::atomic::{", stringify!($atomic_type), ", Ordering};")]
            ///
            #[doc = concat!("let val = ", stringify!($atomic_type), "::new(4);")]
            ///
            /// let mut old = val.load(Ordering::Relaxed);
            /// loop {
            /// let new = old * 2;
            /// match val.compare_exchange_weak(old, new, Ordering::SeqCst, Ordering::Relaxed) {
            /// Ok(_) => break,
            /// Err(x) => old = x,
            ///     }
            /// }
            /// ```
            ///
            /// # Considerations
            ///
            /// `compare_exchange` is a [compare-and-swap operation] and thus exhibits the usual downsides
            /// of CAS operations. In particular, a load of the value followed by a successful
            /// `compare_exchange` with the previous load *does not ensure* that other threads have not
            /// changed the value in the interim. This is usually important when the *equality* check in
            /// the `compare_exchange` is being used to check the *identity* of a value, but equality
            /// does not necessarily imply identity. This is a particularly common case for pointers, as
            /// a pointer holding the same address does not imply that the same object exists at that
            /// address! In this case, `compare_exchange` can lead to the [ABA problem].
            ///
            /// [ABA Problem]: https://en.wikipedia.org/wiki/ABA_problem
            /// [compare-and-swap operation]: https://en.wikipedia.org/wiki/Compare-and-swap
            #[inline]
            #[$stable_cxchg]
            #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
            #[cfg(any($cfg_cas, doc))]
            #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
            #[lint::should_not_be_called_on_const_items]
            pub const fn compare_exchange_weak(&self,
                                         current: $int_type,
                                         new: $int_type,
                                         success: Ordering,
                                         failure: Ordering) -> Result<$int_type, $int_type> {
                // SAFETY: data races are prevented by atomic intrinsics.
                unsafe {
                    atomic_compare_exchange_weak(self.as_ptr(), current, new, success, failure)
                }
            }

            /// Adds to the current value, returning the previous value.
            ///
            /// This operation wraps around on overflow.
            ///
            /// `fetch_add` takes an [`Ordering`] argument which describes the memory ordering
            /// of this operation. All ordering modes are possible. Note that using
            /// [`Acquire`] makes the store part of this operation [`Relaxed`], and
            /// using [`Release`] makes the load part [`Relaxed`].
            ///
            /// **Note**: This method is only available on platforms that support atomic operations on
            #[doc = concat!("[`", $s_int_type, "`].")]
            ///
            /// # Examples
            ///
            #[cfg_attr($cfg_cas, doc = "```")]
            #[cfg_attr(not($cfg_cas), doc = "```compile_fail")]
            #[doc = concat!($extra_feature, "use std::sync::atomic::{", stringify!($atomic_type), ", Ordering};")]
            ///
            #[doc = concat!("let foo = ", stringify!($atomic_type), "::new(0);")]
            /// assert_eq!(foo.fetch_add(10, Ordering::SeqCst), 0);
            /// assert_eq!(foo.load(Ordering::SeqCst), 10);
            /// ```
            #[inline]
            #[$stable]
            #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
            #[cfg(any($cfg_cas, doc))]
            #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
            #[lint::should_not_be_called_on_const_items]
            pub const fn fetch_add(&self, val: $int_type, order: Ordering) -> $int_type {
                // SAFETY: data races are prevented by atomic intrinsics.
                unsafe { atomic_add(self.as_ptr(), val, order) }
            }

            /// Subtracts from the current value, returning the previous value.
            ///
            /// This operation wraps around on overflow.
            ///
            /// `fetch_sub` takes an [`Ordering`] argument which describes the memory ordering
            /// 此操作的所有排序模式均可能。请注意，使用
            /// [`Acquire`] makes the store part of this operation [`Relaxed`], and
            /// using [`Release`] makes the load part [`Relaxed`].
            ///
            /// **注意**：此方法仅在支持原子操作的平台上可用。
            #[doc = concat!("[`", $s_int_type, "`].")]
            ///
            /// # 示例
            ///
            #[cfg_attr($cfg_cas, doc = "```")]
            #[cfg_attr(not($cfg_cas), doc = "```compile_fail")]
            #[doc = concat!($extra_feature, "use std::sync::atomic::{", stringify!($atomic_type), ", Ordering};")]
            ///
            #[doc = concat!("let foo = ", stringify!($atomic_type), "::new(20);")]
            /// assert_eq!(foo.fetch_sub(10, Ordering::SeqCst), 20);
            /// assert_eq!(foo.load(Ordering::SeqCst), 10);
            /// ```
            #[inline]
            #[$stable]
            #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
            #[cfg(any($cfg_cas, doc))]
            #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
            #[lint::should_not_be_called_on_const_items]
            pub const fn fetch_sub(&self, val: $int_type, order: Ordering) -> $int_type {
                // SAFETY: data races are prevented by atomic intrinsics.
                unsafe { atomic_sub(self.as_ptr(), val, order) }
            }

            /// Bitwise "and" with the current value.
            ///
            /// Performs a bitwise "and" operation on the current value and the argument `val`, and
            /// sets the new value to the result.
            ///
            /// Returns the previous value.
            ///
            /// `fetch_and` takes an [`Ordering`] argument which describes the memory ordering
            /// of this operation. All ordering modes are possible. Note that using
            /// [`Acquire`] makes the store part of this operation [`Relaxed`], and
            /// using [`Release`] makes the load part [`Relaxed`].
            ///
            /// **Note**: This method is only available on platforms that support atomic operations on
            #[doc = concat!("[`", $s_int_type, "`].")]
            ///
            /// # Examples
            ///
            #[cfg_attr($cfg_cas, doc = "```")]
            #[cfg_attr(not($cfg_cas), doc = "```compile_fail")]
            #[doc = concat!($extra_feature, "use std::sync::atomic::{", stringify!($atomic_type), ", Ordering};")]
            ///
            #[doc = concat!("let foo = ", stringify!($atomic_type), "::new(0b101101);")]
            /// assert_eq!(foo.fetch_and(0b110011, Ordering::SeqCst), 0b101101);
            /// assert_eq!(foo.load(Ordering::SeqCst), 0b100001);
            /// ```
            #[inline]
            #[$stable]
            #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
            #[cfg(any($cfg_cas, doc))]
            #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
            #[lint::should_not_be_called_on_const_items]
            pub const fn fetch_and(&self, val: $int_type, order: Ordering) -> $int_type {
                // SAFETY: data races are prevented by atomic intrinsics.
                unsafe { atomic_and(self.as_ptr(), val, order) }
            }

            /// 对当前值进行位运算“nand”操作。
            ///
            /// Performs a bitwise "nand" operation on the current value and the argument `val`, and
            /// 将新值设置为结果。
            ///
            /// 返回之前的值。
            ///
            /// `fetch_nand` takes an [`Ordering`] argument which describes the memory ordering
            /// of this operation. All ordering modes are possible. Note that using
            /// [`Acquire`] makes the store part of this operation [`Relaxed`], and
            /// using [`Release`] makes the load part [`Relaxed`].
            ///
            /// **注意**：此方法仅在支持原子操作的平台上可用。
            #[doc = concat!("[`", $s_int_type, "`].")]
            ///
            /// # 示例
            ///
            #[cfg_attr($cfg_cas, doc = "```")]
            #[cfg_attr(not($cfg_cas), doc = "```compile_fail")]
            #[doc = concat!($extra_feature, "use std::sync::atomic::{", stringify!($atomic_type), ", Ordering};")]
            ///
            #[doc = concat!("let foo = ", stringify!($atomic_type), "::new(0x13);")]
            /// assert_eq!(foo.fetch_nand(0x31, Ordering::SeqCst), 0x13);
            /// assert_eq!(foo.load(Ordering::SeqCst), !(0x13 & 0x31));
            /// ```
            #[inline]
            #[$stable_nand]
            #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
            #[cfg(any($cfg_cas, doc))]
            #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
            #[lint::should_not_be_called_on_const_items]
            pub const fn fetch_nand(&self, val: $int_type, order: Ordering) -> $int_type {
                // SAFETY: data races are prevented by atomic intrinsics.
                unsafe { atomic_nand(self.as_ptr(), val, order) }
            }

            /// Bitwise "or" with the current value.
            ///
            /// Performs a bitwise "or" operation on the current value and the argument `val`, and
            /// sets the new value to the result.
            ///
            /// Returns the previous value.
            ///
            /// `fetch_or` takes an [`Ordering`] argument which describes the memory ordering
            /// of this operation. All ordering modes are possible. Note that using
            /// [`Acquire`] makes the store part of this operation [`Relaxed`], and
            /// using [`Release`] makes the load part [`Relaxed`].
            ///
            /// **Note**: This method is only available on platforms that support atomic operations on
            #[doc = concat!("[`", $s_int_type, "`].")]
            ///
            /// # Examples
            ///
            #[cfg_attr($cfg_cas, doc = "```")]
            #[cfg_attr(not($cfg_cas), doc = "```compile_fail")]
            #[doc = concat!($extra_feature, "use std::sync::atomic::{", stringify!($atomic_type), ", Ordering};")]
            ///
            #[doc = concat!("let foo = ", stringify!($atomic_type), "::new(0b101101);")]
            /// assert_eq!(foo.fetch_or(0b110011, Ordering::SeqCst), 0b101101);
            /// assert_eq!(foo.load(Ordering::SeqCst), 0b111111);
            /// ```
            #[inline]
            #[$stable]
            #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
            #[cfg(any($cfg_cas, doc))]
            #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
            #[lint::should_not_be_called_on_const_items]
            pub const fn fetch_or(&self, val: $int_type, order: Ordering) -> $int_type {
                // SAFETY: data races are prevented by atomic intrinsics.
                unsafe { atomic_or(self.as_ptr(), val, order) }
            }

            /// 对当前值进行位运算“xor”操作。
            ///
            /// Performs a bitwise "xor" operation on the current value and the argument `val`, and
            /// 将新值设置为结果。
            ///
            /// 返回之前的值。
            ///
            /// `fetch_xor` takes an [`Ordering`] argument which describes the memory ordering
            /// 此操作的所有排序模式均可能。请注意，使用
            /// [`Acquire`] makes the store part of this operation [`Relaxed`], and
            /// using [`Release`] makes the load part [`Relaxed`].
            ///
            /// **注意**：此方法仅在支持原子操作的平台上可用。
            #[doc = concat!("[`", $s_int_type, "`].")]
            ///
            /// # 示例
            ///
            #[cfg_attr($cfg_cas, doc = "```")]
            #[cfg_attr(not($cfg_cas), doc = "```compile_fail")]
            #[doc = concat!($extra_feature, "use std::sync::atomic::{", stringify!($atomic_type), ", Ordering};")]
            ///
            #[doc = concat!("let foo = ", stringify!($atomic_type), "::new(0b101101);")]
            /// assert_eq!(foo.fetch_xor(0b110011, Ordering::SeqCst), 0b101101);
            /// assert_eq!(foo.load(Ordering::SeqCst), 0b011110);
            /// ```
            #[inline]
            #[$stable]
            #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
            #[cfg(any($cfg_cas, doc))]
            #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
            #[lint::should_not_be_called_on_const_items]
            pub const fn fetch_xor(&self, val: $int_type, order: Ordering) -> $int_type {
                // SAFETY: data races are prevented by atomic intrinsics.
                unsafe { atomic_xor(self.as_ptr(), val, order) }
            }

            /// An alias for
            #[doc = concat!("[`", stringify!($atomic_type), "::try_update`]")]
            /// .
            #[inline]
            #[stable(feature = "no_more_cas", since = "1.45.0")]
            #[cfg(any($cfg_cas, doc))]
            #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
            #[lint::should_not_be_called_on_const_items]
            #[deprecated(
                since = "1.99.0",
                note = "renamed to `try_update` for consistency",
                suggestion = "try_update"
            )]
            pub fn fetch_update<F>(&self,
                                   set_order: Ordering,
                                   fetch_order: Ordering,
                                   f: F) -> Result<$int_type, $int_type>
            where F: FnMut($int_type) -> Option<$int_type> {
                self.try_update(set_order, fetch_order, f)
            }

            /// Fetches the value, and applies a function to it that returns an optional
            /// new value. Returns a `Result` of `Ok(previous_value)` if the function returned `Some(_)`, else
            /// `Err(previous_value)`.
            ///
            #[doc = concat!("See also: [`update`](`", stringify!($atomic_type), "::update`).")]
            ///
            /// Note: This may call the function multiple times if the value has been changed from other threads in
            /// the meantime, as long as the function returns `Some(_)`, but the function will have been applied
            /// only once to the stored value.
            ///
            /// `try_update` takes two [`Ordering`] arguments to describe the memory ordering of this operation.
            /// The first describes the required ordering for when the operation finally succeeds while the second
            /// describes the required ordering for loads. These correspond to the success and failure orderings of
            #[doc = concat!("[`", stringify!($atomic_type), "::compare_exchange`]")]
            /// respectively.
            ///
            /// Using [`Acquire`] as success ordering makes the store part
            /// of this operation [`Relaxed`], and using [`Release`] makes the final successful load
            /// [`Relaxed`]. The (failed) load ordering can only be [`SeqCst`], [`Acquire`] or [`Relaxed`].
            ///
            /// **Note**: This method is only available on platforms that support atomic operations on
            #[doc = concat!("[`", $s_int_type, "`].")]
            ///
            /// # Considerations
            ///
            /// This method is not magic; it is not provided by the hardware, and does not act like a
            /// critical section or mutex.
            ///
            /// It is implemented on top of an atomic [compare-and-swap operation], and thus is subject to
            /// the usual drawbacks of CAS operations. In particular, be careful of the [ABA problem]
            /// if this atomic integer is an index or more generally if knowledge of only the *bitwise value*
            /// of the atomic is not in and of itself sufficient to ensure any required preconditions.
            ///
            /// [ABA Problem]: https://en.wikipedia.org/wiki/ABA_problem
            /// [compare-and-swap operation]: https://en.wikipedia.org/wiki/Compare-and-swap
            ///
            /// # Examples
            ///
            #[cfg_attr($cfg_cas, doc = "```rust")]
            #[cfg_attr(not($cfg_cas), doc = "```rust,compile_fail")]
            #[doc = concat!($extra_feature, "use std::sync::atomic::{", stringify!($atomic_type), ", Ordering};")]
            ///
            #[doc = concat!("let x = ", stringify!($atomic_type), "::new(7);")]
            /// assert_eq!(x.try_update(Ordering::SeqCst, Ordering::SeqCst, |_| None), Err(7));
            /// assert_eq!(x.try_update(Ordering::SeqCst, Ordering::SeqCst, |x| Some(x + 1)), Ok(7));
            /// assert_eq!(x.try_update(Ordering::SeqCst, Ordering::SeqCst, |x| Some(x + 1)), Ok(8));
            /// assert_eq!(x.load(Ordering::SeqCst), 9);
            /// ```
            #[inline]
            #[stable(feature = "atomic_try_update", since = "1.95.0")]
            #[cfg(any($cfg_cas, doc))]
            #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
            #[lint::should_not_be_called_on_const_items]
            pub fn try_update(
                &self,
                set_order: Ordering,
                fetch_order: Ordering,
                mut f: impl FnMut($int_type) -> Option<$int_type>,
            ) -> Result<$int_type, $int_type> {
                let mut prev = self.load(fetch_order);
                while let Some(next) = f(prev) {
                    match self.compare_exchange_weak(prev, next, set_order, fetch_order) {
                        x @ Ok(_) => return x,
                        Err(next_prev) => prev = next_prev
                    }
                }
                Err(prev)
            }

            /// 获取值，并应用一个返回新值的函数。
            /// 新值被存储，旧值被返回。
            ///
            #[doc = concat!("See also: [`try_update`](`", stringify!($atomic_type), "::try_update`).")]
            ///
            /// 注意：如果值在期间被其他线程更改，该方法可能会多次调用该函数，但函数仅对存储的值应用一次。
            /// 在此期间，但函数只会对存储的值应用一次。
            ///
            /// `update` takes two [`Ordering`] arguments to describe the memory ordering of this operation.
            /// 第一个参数描述操作最终成功时所需的排序方式，第二个参数
            /// 描述加载时所需的排序方式。这些对应于成功的和失败的排序方式。
            #[doc = concat!("[`", stringify!($atomic_type), "::compare_exchange`]")]
            /// 分别。
            ///
            /// Using [`Acquire`] as success ordering makes the store part
            /// of this operation [`Relaxed`], and using [`Release`] makes the final successful load
            /// [`Relaxed`]. The (failed) load ordering can only be [`SeqCst`], [`Acquire`] or [`Relaxed`].
            ///
            /// **注意**：此方法仅适用于支持原子操作的平台。
            #[doc = concat!("[`", $s_int_type, "`].")]
            ///
            /// # 注意事项
            ///
            /// [CAS operation]: https://en.wikipedia.org/wiki/Compare-and-swap
            /// 此方法并非魔法；它不是由硬件提供的，也不像
            /// 关键段或互斥锁那样起作用。
            ///
            /// 它是基于原子 [比较与交换操作] 实现的，因此存在
            /// CAS 操作的常见缺点。特别是要注意 [ABA 问题]
            /// 如果此原子整数是一个索引，或者更一般地说，如果仅知道该原子的
            /// 位值而不了解其整体含义，则不足以确保所需的前置条件。
            ///
            /// [ABA Problem]: https://en.wikipedia.org/wiki/ABA_problem
            /// [compare-and-swap operation]: https://en.wikipedia.org/wiki/Compare-and-swap
            ///
            /// # 示例
            ///
            #[cfg_attr($cfg_cas, doc = "```rust")]
            #[cfg_attr(not($cfg_cas), doc = "```rust,compile_fail")]
            #[doc = concat!($extra_feature, "use std::sync::atomic::{", stringify!($atomic_type), ", Ordering};")]
            ///
            #[doc = concat!("let x = ", stringify!($atomic_type), "::new(7);")]
            /// assert_eq!(x.update(Ordering::SeqCst, Ordering::SeqCst, |x| x + 1), 7);
            /// assert_eq!(x.update(Ordering::SeqCst, Ordering::SeqCst, |x| x + 1), 8);
            /// assert_eq!(x.load(Ordering::SeqCst), 9);
            /// ```
            #[inline]
            #[stable(feature = "atomic_try_update", since = "1.95.0")]
            #[cfg(any($cfg_cas, doc))]
            #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
            #[lint::should_not_be_called_on_const_items]
            pub fn update(
                &self,
                set_order: Ordering,
                fetch_order: Ordering,
                mut f: impl FnMut($int_type) -> $int_type,
            ) -> $int_type {
                let mut prev = self.load(fetch_order);
                loop {
                    match self.compare_exchange_weak(prev, f(prev), set_order, fetch_order) {
                        Ok(x) => break x,
                        Err(next_prev) => prev = next_prev,
                    }
                }
            }

            /// Maximum with the current value.
            ///
            /// Finds the maximum of the current value and the argument `val`, and
            /// sets the new value to the result.
            ///
            /// Returns the previous value.
            ///
            /// `fetch_max` takes an [`Ordering`] argument which describes the memory ordering
            /// of this operation. All ordering modes are possible. Note that using
            /// [`Acquire`] makes the store part of this operation [`Relaxed`], and
            /// using [`Release`] makes the load part [`Relaxed`].
            ///
            /// **Note**: This method is only available on platforms that support atomic operations on
            #[doc = concat!("[`", $s_int_type, "`].")]
            ///
            /// # Examples
            ///
            #[cfg_attr($cfg_cas, doc = "```")]
            #[cfg_attr(not($cfg_cas), doc = "```compile_fail")]
            #[doc = concat!($extra_feature, "use std::sync::atomic::{", stringify!($atomic_type), ", Ordering};")]
            ///
            #[doc = concat!("let foo = ", stringify!($atomic_type), "::new(23);")]
            /// assert_eq!(foo.fetch_max(42, Ordering::SeqCst), 23);
            /// assert_eq!(foo.load(Ordering::SeqCst), 42);
            /// ```
            ///
            /// 如果您想一步获取最大值，可以使用以下方法：
            ///
            #[cfg_attr($cfg_cas, doc = "```")]
            #[cfg_attr(not($cfg_cas), doc = "```compile_fail")]
            #[doc = concat!($extra_feature, "use std::sync::atomic::{", stringify!($atomic_type), ", Ordering};")]
            ///
            #[doc = concat!("let foo = ", stringify!($atomic_type), "::new(23);")]
            /// let bar = 42;
            /// let max_foo = foo.fetch_max(bar, Ordering::SeqCst).max(bar);
            /// assert!(max_foo == 42);
            /// ```
            #[inline]
            #[stable(feature = "atomic_min_max", since = "1.45.0")]
            #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
            #[cfg(any($cfg_cas, doc))]
            #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
            #[lint::should_not_be_called_on_const_items]
            pub const fn fetch_max(&self, val: $int_type, order: Ordering) -> $int_type {
                // SAFETY: data races are prevented by atomic intrinsics.
                unsafe { $max_fn(self.as_ptr(), val, order) }
            }

            /// Minimum with the current value.
            ///
            /// Finds the minimum of the current value and the argument `val`, and
            /// sets the new value to the result.
            ///
            /// Returns the previous value.
            ///
            /// `fetch_min` takes an [`Ordering`] argument which describes the memory ordering
            /// of this operation. All ordering modes are possible. Note that using
            /// [`Acquire`] makes the store part of this operation [`Relaxed`], and
            /// using [`Release`] makes the load part [`Relaxed`].
            ///
            /// **Note**: This method is only available on platforms that support atomic operations on
            #[doc = concat!("[`", $s_int_type, "`].")]
            ///
            /// # Examples
            ///
            #[cfg_attr($cfg_cas, doc = "```")]
            #[cfg_attr(not($cfg_cas), doc = "```compile_fail")]
            #[doc = concat!($extra_feature, "use std::sync::atomic::{", stringify!($atomic_type), ", Ordering};")]
            ///
            #[doc = concat!("let foo = ", stringify!($atomic_type), "::new(23);")]
            /// assert_eq!(foo.fetch_min(42, Ordering::Relaxed), 23);
            /// assert_eq!(foo.load(Ordering::Relaxed), 23);
            /// assert_eq!(foo.fetch_min(22, Ordering::Relaxed), 23);
            /// assert_eq!(foo.load(Ordering::Relaxed), 22);
            /// ```
            ///
            /// 如果您想一步获取最小值，可以使用以下方法：
            ///
            #[cfg_attr($cfg_cas, doc = "```")]
            #[cfg_attr(not($cfg_cas), doc = "```compile_fail")]
            #[doc = concat!($extra_feature, "use std::sync::atomic::{", stringify!($atomic_type), ", Ordering};")]
            ///
            #[doc = concat!("let foo = ", stringify!($atomic_type), "::new(23);")]
            /// let bar = 12;
            /// let min_foo = foo.fetch_min(bar, Ordering::SeqCst).min(bar);
            /// assert_eq!(min_foo, 12);
            /// ```
            #[inline]
            #[stable(feature = "atomic_min_max", since = "1.45.0")]
            #[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
            #[cfg(any($cfg_cas, doc))]
            #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
            #[lint::should_not_be_called_on_const_items]
            pub const fn fetch_min(&self, val: $int_type, order: Ordering) -> $int_type {
                // SAFETY: data races are prevented by atomic intrinsics.
                unsafe { $min_fn(self.as_ptr(), val, order) }
            }

            /// Returns a mutable pointer to the underlying integer.
            ///
            /// Doing non-atomic reads and writes on the resulting integer can be a data race.
            /// This method is mostly useful for FFI, where the function signature may use
            #[doc = concat!("`*mut ", stringify!($int_type), "` instead of `&", stringify!($atomic_type), "`.")]
            ///
            /// Returning an `*mut` pointer from a shared reference to this atomic is safe because the
            /// atomic types work with interior mutability. All modifications of an atomic change the value
            /// through a shared reference, and can do so safely as long as they use atomic operations. Any
            /// use of the returned raw pointer requires an `unsafe` block and still has to uphold the
            /// requirements of the [memory model].
            ///
            /// # Examples
            ///
            /// ```ignore (extern-declaration)
            /// # fn main() {
            #[doc = concat!($extra_feature, "use std::sync::atomic::", stringify!($atomic_type), ";")]
            ///
            /// extern "C" {
            #[doc = concat!("    fn my_atomic_op(arg: *mut ", stringify!($int_type), ");")]
            /// }
            ///
            #[doc = concat!("let atomic = ", stringify!($atomic_type), "::new(1);")]
            ///
            /// // SAFETY: Safe as long as `my_atomic_op` is atomic.
            /// unsafe {
            /// my_atomic_op(atomic.as_ptr());
            /// }
            /// # }
            /// ```
            ///
            /// [memory model]: self#memory-model-for-atomic-accesses
            #[inline]
            #[stable(feature = "atomic_as_ptr", since = "1.70.0")]
            #[rustc_const_stable(feature = "atomic_as_ptr", since = "1.70.0")]
            #[lint::never_returns_null_ptr]
            pub const fn as_ptr(&self) -> *mut $int_type {
                self.v.get().cast()
            }
        }
    }
}

#[cfg(target_has_atomic_load_store = "8")]
atomic_int! {
    target_has_atomic_load_store = "8",
    target_has_atomic = "8",
    target_has_atomic_primitive_alignment = "8",
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    rustc_const_stable(feature = "const_integer_atomics", since = "1.34.0"),
    rustc_const_stable(feature = "const_atomic_into_inner", since = "1.79.0"),
    "i8",
    "",
    atomic_min, atomic_max,
    1,
    i8 AtomicI8
}
#[cfg(target_has_atomic_load_store = "8")]
atomic_int! {
    target_has_atomic_load_store = "8",
    target_has_atomic = "8",
    target_has_atomic_primitive_alignment = "8",
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    rustc_const_stable(feature = "const_integer_atomics", since = "1.34.0"),
    rustc_const_stable(feature = "const_atomic_into_inner", since = "1.79.0"),
    "u8",
    "",
    atomic_umin, atomic_umax,
    1,
    u8 AtomicU8
}
#[cfg(target_has_atomic_load_store = "16")]
atomic_int! {
    target_has_atomic_load_store = "16",
    target_has_atomic = "16",
    target_has_atomic_primitive_alignment = "16",
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    rustc_const_stable(feature = "const_integer_atomics", since = "1.34.0"),
    rustc_const_stable(feature = "const_atomic_into_inner", since = "1.79.0"),
    "i16",
    "",
    atomic_min, atomic_max,
    2,
    i16 AtomicI16
}
#[cfg(target_has_atomic_load_store = "16")]
atomic_int! {
    target_has_atomic_load_store = "16",
    target_has_atomic = "16",
    target_has_atomic_primitive_alignment = "16",
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    rustc_const_stable(feature = "const_integer_atomics", since = "1.34.0"),
    rustc_const_stable(feature = "const_atomic_into_inner", since = "1.79.0"),
    "u16",
    "",
    atomic_umin, atomic_umax,
    2,
    u16 AtomicU16
}
#[cfg(target_has_atomic_load_store = "32")]
atomic_int! {
    target_has_atomic_load_store = "32",
    target_has_atomic = "32",
    target_has_atomic_primitive_alignment = "32",
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    rustc_const_stable(feature = "const_integer_atomics", since = "1.34.0"),
    rustc_const_stable(feature = "const_atomic_into_inner", since = "1.79.0"),
    "i32",
    "",
    atomic_min, atomic_max,
    4,
    i32 AtomicI32
}
#[cfg(target_has_atomic_load_store = "32")]
atomic_int! {
    target_has_atomic_load_store = "32",
    target_has_atomic = "32",
    target_has_atomic_primitive_alignment = "32",
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    rustc_const_stable(feature = "const_integer_atomics", since = "1.34.0"),
    rustc_const_stable(feature = "const_atomic_into_inner", since = "1.79.0"),
    "u32",
    "",
    atomic_umin, atomic_umax,
    4,
    u32 AtomicU32
}
#[cfg(target_has_atomic_load_store = "64")]
atomic_int! {
    target_has_atomic_load_store = "64",
    target_has_atomic = "64",
    target_has_atomic_primitive_alignment = "64",
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    rustc_const_stable(feature = "const_integer_atomics", since = "1.34.0"),
    rustc_const_stable(feature = "const_atomic_into_inner", since = "1.79.0"),
    "i64",
    "",
    atomic_min, atomic_max,
    8,
    i64 AtomicI64
}
#[cfg(target_has_atomic_load_store = "64")]
atomic_int! {
    target_has_atomic_load_store = "64",
    target_has_atomic = "64",
    target_has_atomic_primitive_alignment = "64",
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    stable(feature = "integer_atomics_stable", since = "1.34.0"),
    rustc_const_stable(feature = "const_integer_atomics", since = "1.34.0"),
    rustc_const_stable(feature = "const_atomic_into_inner", since = "1.79.0"),
    "u64",
    "",
    atomic_umin, atomic_umax,
    8,
    u64 AtomicU64
}
#[cfg(any(target_has_atomic_load_store = "128", doc))]
atomic_int! {
    target_has_atomic_load_store = "128",
    target_has_atomic = "128",
    target_has_atomic_primitive_alignment = "128",
    unstable(feature = "integer_atomics", issue = "99069"),
    unstable(feature = "integer_atomics", issue = "99069"),
    unstable(feature = "integer_atomics", issue = "99069"),
    unstable(feature = "integer_atomics", issue = "99069"),
    unstable(feature = "integer_atomics", issue = "99069"),
    unstable(feature = "integer_atomics", issue = "99069"),
    rustc_const_unstable(feature = "integer_atomics", issue = "99069"),
    rustc_const_unstable(feature = "integer_atomics", issue = "99069"),
    "i128",
    "#![feature(integer_atomics)]\n\n",
    atomic_min, atomic_max,
    16,
    i128 AtomicI128
}
#[cfg(any(target_has_atomic_load_store = "128", doc))]
atomic_int! {
    target_has_atomic_load_store = "128",
    target_has_atomic = "128",
    target_has_atomic_primitive_alignment = "128",
    unstable(feature = "integer_atomics", issue = "99069"),
    unstable(feature = "integer_atomics", issue = "99069"),
    unstable(feature = "integer_atomics", issue = "99069"),
    unstable(feature = "integer_atomics", issue = "99069"),
    unstable(feature = "integer_atomics", issue = "99069"),
    unstable(feature = "integer_atomics", issue = "99069"),
    rustc_const_unstable(feature = "integer_atomics", issue = "99069"),
    rustc_const_unstable(feature = "integer_atomics", issue = "99069"),
    "u128",
    "#![feature(integer_atomics)]\n\n",
    atomic_umin, atomic_umax,
    16,
    u128 AtomicU128
}

#[cfg(target_has_atomic_load_store = "ptr")]
macro_rules! atomic_int_ptr_sized {
    ( $($target_pointer_width:literal $align:literal)* ) => { $(
        #[cfg(target_pointer_width = $target_pointer_width)]
        atomic_int! {
            target_has_atomic_load_store = "ptr",
            target_has_atomic = "ptr",
            target_has_atomic_primitive_alignment = "ptr",
            stable(feature = "rust1", since = "1.0.0"),
            stable(feature = "extended_compare_and_swap", since = "1.10.0"),
            stable(feature = "atomic_debug", since = "1.3.0"),
            stable(feature = "atomic_access", since = "1.15.0"),
            stable(feature = "atomic_from", since = "1.23.0"),
            stable(feature = "atomic_nand", since = "1.27.0"),
            rustc_const_stable(feature = "const_ptr_sized_atomics", since = "1.24.0"),
            rustc_const_stable(feature = "const_atomic_into_inner", since = "1.79.0"),
            "isize",
            "",
            atomic_min, atomic_max,
            $align,
            isize AtomicIsize
        }
        #[cfg(target_pointer_width = $target_pointer_width)]
        atomic_int! {
            target_has_atomic_load_store = "ptr",
            target_has_atomic = "ptr",
            target_has_atomic_primitive_alignment = "ptr",
            stable(feature = "rust1", since = "1.0.0"),
            stable(feature = "extended_compare_and_swap", since = "1.10.0"),
            stable(feature = "atomic_debug", since = "1.3.0"),
            stable(feature = "atomic_access", since = "1.15.0"),
            stable(feature = "atomic_from", since = "1.23.0"),
            stable(feature = "atomic_nand", since = "1.27.0"),
            rustc_const_stable(feature = "const_ptr_sized_atomics", since = "1.24.0"),
            rustc_const_stable(feature = "const_atomic_into_inner", since = "1.79.0"),
            "usize",
            "",
            atomic_umin, atomic_umax,
            $align,
            usize AtomicUsize
        }

        /// An [`AtomicIsize`] initialized to `0`.
        #[cfg(target_pointer_width = $target_pointer_width)]
        #[stable(feature = "rust1", since = "1.0.0")]
        #[deprecated(
            since = "1.34.0",
            note = "the `new` function is now preferred",
            suggestion = "AtomicIsize::new(0)",
        )]
        #[expect(clippy::declare_interior_mutable_const, reason = "legacy atomic initializer")]
        pub const ATOMIC_ISIZE_INIT: AtomicIsize = AtomicIsize::new(0);

        /// An [`AtomicUsize`] initialized to `0`.
        #[cfg(target_pointer_width = $target_pointer_width)]
        #[stable(feature = "rust1", since = "1.0.0")]
        #[deprecated(
            since = "1.34.0",
            note = "the `new` function is now preferred",
            suggestion = "AtomicUsize::new(0)",
        )]
        #[expect(clippy::declare_interior_mutable_const, reason = "legacy atomic initializer")]
        pub const ATOMIC_USIZE_INIT: AtomicUsize = AtomicUsize::new(0);
    )* };
}

#[cfg(target_has_atomic_load_store = "ptr")]
atomic_int_ptr_sized! {
    "16" 2
    "32" 4
    "64" 8
}

#[inline]
#[cfg(target_has_atomic)]
const fn strongest_failure_ordering(order: Ordering) -> Ordering {
    match order {
        Release => Relaxed,
        Relaxed => Relaxed,
        SeqCst => SeqCst,
        Acquire => Acquire,
        AcqRel => Acquire,
    }
}

#[inline]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
#[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
const unsafe fn atomic_store<T: Copy, const VOLATILE: bool>(dst: *mut T, val: T, order: Ordering) {
    // SAFETY: the caller must uphold the safety contract for `atomic_store`.
    unsafe {
        match order {
            Relaxed => intrinsics::atomic_store::<T, { AO::Relaxed }, VOLATILE>(dst, val),
            Release => intrinsics::atomic_store::<T, { AO::Release }, VOLATILE>(dst, val),
            SeqCst => intrinsics::atomic_store::<T, { AO::SeqCst }, VOLATILE>(dst, val),
            Acquire => panic!("there is no such thing as an acquire store"),
            AcqRel => panic!("there is no such thing as an acquire-release store"),
        }
    }
}

#[inline]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
#[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
const unsafe fn atomic_load<T: Copy, const VOLATILE: bool>(dst: *const T, order: Ordering) -> T {
    // SAFETY: the caller must uphold the safety contract for `atomic_load`.
    unsafe {
        match order {
            Relaxed => intrinsics::atomic_load::<T, { AO::Relaxed }, VOLATILE>(dst),
            Acquire => intrinsics::atomic_load::<T, { AO::Acquire }, VOLATILE>(dst),
            SeqCst => intrinsics::atomic_load::<T, { AO::SeqCst }, VOLATILE>(dst),
            Release => panic!("there is no such thing as a release load"),
            AcqRel => panic!("there is no such thing as an acquire-release load"),
        }
    }
}

#[inline]
#[cfg(target_has_atomic)]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
#[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
const unsafe fn atomic_swap<T: Copy>(dst: *mut T, val: T, order: Ordering) -> T {
    // SAFETY: the caller must uphold the safety contract for `atomic_swap`.
    unsafe {
        match order {
            Relaxed => intrinsics::atomic_xchg::<T, { AO::Relaxed }>(dst, val),
            Acquire => intrinsics::atomic_xchg::<T, { AO::Acquire }>(dst, val),
            Release => intrinsics::atomic_xchg::<T, { AO::Release }>(dst, val),
            AcqRel => intrinsics::atomic_xchg::<T, { AO::AcqRel }>(dst, val),
            SeqCst => intrinsics::atomic_xchg::<T, { AO::SeqCst }>(dst, val),
        }
    }
}

/// Returns the previous value (like __sync_fetch_and_add).
#[inline]
#[cfg(target_has_atomic)]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
#[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
const unsafe fn atomic_add<T: Copy, U: Copy>(dst: *mut T, val: U, order: Ordering) -> T {
    // SAFETY: the caller must uphold the safety contract for `atomic_add`.
    unsafe {
        match order {
            Relaxed => intrinsics::atomic_xadd::<T, U, { AO::Relaxed }>(dst, val),
            Acquire => intrinsics::atomic_xadd::<T, U, { AO::Acquire }>(dst, val),
            Release => intrinsics::atomic_xadd::<T, U, { AO::Release }>(dst, val),
            AcqRel => intrinsics::atomic_xadd::<T, U, { AO::AcqRel }>(dst, val),
            SeqCst => intrinsics::atomic_xadd::<T, U, { AO::SeqCst }>(dst, val),
        }
    }
}

/// Returns the previous value (like __sync_fetch_and_sub).
#[inline]
#[cfg(target_has_atomic)]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
#[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
const unsafe fn atomic_sub<T: Copy, U: Copy>(dst: *mut T, val: U, order: Ordering) -> T {
    // SAFETY: the caller must uphold the safety contract for `atomic_sub`.
    unsafe {
        match order {
            Relaxed => intrinsics::atomic_xsub::<T, U, { AO::Relaxed }>(dst, val),
            Acquire => intrinsics::atomic_xsub::<T, U, { AO::Acquire }>(dst, val),
            Release => intrinsics::atomic_xsub::<T, U, { AO::Release }>(dst, val),
            AcqRel => intrinsics::atomic_xsub::<T, U, { AO::AcqRel }>(dst, val),
            SeqCst => intrinsics::atomic_xsub::<T, U, { AO::SeqCst }>(dst, val),
        }
    }
}

/// Publicly exposed for stdarch; nobody else should use this.
#[inline]
#[cfg(target_has_atomic)]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
#[unstable(feature = "core_intrinsics", issue = "none")]
#[doc(hidden)]
#[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
pub const unsafe fn atomic_compare_exchange<T: Copy>(
    dst: *mut T,
    old: T,
    new: T,
    success: Ordering,
    failure: Ordering,
) -> Result<T, T> {
    // SAFETY: the caller must uphold the safety contract for `atomic_compare_exchange`.
    let (val, ok) = unsafe {
        match (success, failure) {
            (Relaxed, Relaxed) => {
                intrinsics::atomic_cxchg::<T, { AO::Relaxed }, { AO::Relaxed }>(dst, old, new)
            }
            (Relaxed, Acquire) => {
                intrinsics::atomic_cxchg::<T, { AO::Relaxed }, { AO::Acquire }>(dst, old, new)
            }
            (Relaxed, SeqCst) => {
                intrinsics::atomic_cxchg::<T, { AO::Relaxed }, { AO::SeqCst }>(dst, old, new)
            }
            (Acquire, Relaxed) => {
                intrinsics::atomic_cxchg::<T, { AO::Acquire }, { AO::Relaxed }>(dst, old, new)
            }
            (Acquire, Acquire) => {
                intrinsics::atomic_cxchg::<T, { AO::Acquire }, { AO::Acquire }>(dst, old, new)
            }
            (Acquire, SeqCst) => {
                intrinsics::atomic_cxchg::<T, { AO::Acquire }, { AO::SeqCst }>(dst, old, new)
            }
            (Release, Relaxed) => {
                intrinsics::atomic_cxchg::<T, { AO::Release }, { AO::Relaxed }>(dst, old, new)
            }
            (Release, Acquire) => {
                intrinsics::atomic_cxchg::<T, { AO::Release }, { AO::Acquire }>(dst, old, new)
            }
            (Release, SeqCst) => {
                intrinsics::atomic_cxchg::<T, { AO::Release }, { AO::SeqCst }>(dst, old, new)
            }
            (AcqRel, Relaxed) => {
                intrinsics::atomic_cxchg::<T, { AO::AcqRel }, { AO::Relaxed }>(dst, old, new)
            }
            (AcqRel, Acquire) => {
                intrinsics::atomic_cxchg::<T, { AO::AcqRel }, { AO::Acquire }>(dst, old, new)
            }
            (AcqRel, SeqCst) => {
                intrinsics::atomic_cxchg::<T, { AO::AcqRel }, { AO::SeqCst }>(dst, old, new)
            }
            (SeqCst, Relaxed) => {
                intrinsics::atomic_cxchg::<T, { AO::SeqCst }, { AO::Relaxed }>(dst, old, new)
            }
            (SeqCst, Acquire) => {
                intrinsics::atomic_cxchg::<T, { AO::SeqCst }, { AO::Acquire }>(dst, old, new)
            }
            (SeqCst, SeqCst) => {
                intrinsics::atomic_cxchg::<T, { AO::SeqCst }, { AO::SeqCst }>(dst, old, new)
            }
            (_, AcqRel) => panic!("there is no such thing as an acquire-release failure ordering"),
            (_, Release) => panic!("there is no such thing as a release failure ordering"),
        }
    };
    if ok { Ok(val) } else { Err(val) }
}

#[inline]
#[cfg(target_has_atomic)]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
#[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
const unsafe fn atomic_compare_exchange_weak<T: Copy>(
    dst: *mut T,
    old: T,
    new: T,
    success: Ordering,
    failure: Ordering,
) -> Result<T, T> {
    // SAFETY: the caller must uphold the safety contract for `atomic_compare_exchange_weak`.
    let (val, ok) = unsafe {
        match (success, failure) {
            (Relaxed, Relaxed) => {
                intrinsics::atomic_cxchgweak::<T, { AO::Relaxed }, { AO::Relaxed }>(dst, old, new)
            }
            (Relaxed, Acquire) => {
                intrinsics::atomic_cxchgweak::<T, { AO::Relaxed }, { AO::Acquire }>(dst, old, new)
            }
            (Relaxed, SeqCst) => {
                intrinsics::atomic_cxchgweak::<T, { AO::Relaxed }, { AO::SeqCst }>(dst, old, new)
            }
            (Acquire, Relaxed) => {
                intrinsics::atomic_cxchgweak::<T, { AO::Acquire }, { AO::Relaxed }>(dst, old, new)
            }
            (Acquire, Acquire) => {
                intrinsics::atomic_cxchgweak::<T, { AO::Acquire }, { AO::Acquire }>(dst, old, new)
            }
            (Acquire, SeqCst) => {
                intrinsics::atomic_cxchgweak::<T, { AO::Acquire }, { AO::SeqCst }>(dst, old, new)
            }
            (Release, Relaxed) => {
                intrinsics::atomic_cxchgweak::<T, { AO::Release }, { AO::Relaxed }>(dst, old, new)
            }
            (Release, Acquire) => {
                intrinsics::atomic_cxchgweak::<T, { AO::Release }, { AO::Acquire }>(dst, old, new)
            }
            (Release, SeqCst) => {
                intrinsics::atomic_cxchgweak::<T, { AO::Release }, { AO::SeqCst }>(dst, old, new)
            }
            (AcqRel, Relaxed) => {
                intrinsics::atomic_cxchgweak::<T, { AO::AcqRel }, { AO::Relaxed }>(dst, old, new)
            }
            (AcqRel, Acquire) => {
                intrinsics::atomic_cxchgweak::<T, { AO::AcqRel }, { AO::Acquire }>(dst, old, new)
            }
            (AcqRel, SeqCst) => {
                intrinsics::atomic_cxchgweak::<T, { AO::AcqRel }, { AO::SeqCst }>(dst, old, new)
            }
            (SeqCst, Relaxed) => {
                intrinsics::atomic_cxchgweak::<T, { AO::SeqCst }, { AO::Relaxed }>(dst, old, new)
            }
            (SeqCst, Acquire) => {
                intrinsics::atomic_cxchgweak::<T, { AO::SeqCst }, { AO::Acquire }>(dst, old, new)
            }
            (SeqCst, SeqCst) => {
                intrinsics::atomic_cxchgweak::<T, { AO::SeqCst }, { AO::SeqCst }>(dst, old, new)
            }
            (_, AcqRel) => panic!("there is no such thing as an acquire-release failure ordering"),
            (_, Release) => panic!("there is no such thing as a release failure ordering"),
        }
    };
    if ok { Ok(val) } else { Err(val) }
}

#[inline]
#[cfg(target_has_atomic)]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
#[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
const unsafe fn atomic_and<T: Copy, U: Copy>(dst: *mut T, val: U, order: Ordering) -> T {
    // SAFETY: the caller must uphold the safety contract for `atomic_and`
    unsafe {
        match order {
            Relaxed => intrinsics::atomic_and::<T, U, { AO::Relaxed }>(dst, val),
            Acquire => intrinsics::atomic_and::<T, U, { AO::Acquire }>(dst, val),
            Release => intrinsics::atomic_and::<T, U, { AO::Release }>(dst, val),
            AcqRel => intrinsics::atomic_and::<T, U, { AO::AcqRel }>(dst, val),
            SeqCst => intrinsics::atomic_and::<T, U, { AO::SeqCst }>(dst, val),
        }
    }
}

#[inline]
#[cfg(target_has_atomic)]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
#[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
const unsafe fn atomic_nand<T: Copy, U: Copy>(dst: *mut T, val: U, order: Ordering) -> T {
    // SAFETY: the caller must uphold the safety contract for `atomic_nand`
    unsafe {
        match order {
            Relaxed => intrinsics::atomic_nand::<T, U, { AO::Relaxed }>(dst, val),
            Acquire => intrinsics::atomic_nand::<T, U, { AO::Acquire }>(dst, val),
            Release => intrinsics::atomic_nand::<T, U, { AO::Release }>(dst, val),
            AcqRel => intrinsics::atomic_nand::<T, U, { AO::AcqRel }>(dst, val),
            SeqCst => intrinsics::atomic_nand::<T, U, { AO::SeqCst }>(dst, val),
        }
    }
}

#[inline]
#[cfg(target_has_atomic)]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
#[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
const unsafe fn atomic_or<T: Copy, U: Copy>(dst: *mut T, val: U, order: Ordering) -> T {
    // SAFETY: the caller must uphold the safety contract for `atomic_or`
    unsafe {
        match order {
            SeqCst => intrinsics::atomic_or::<T, U, { AO::SeqCst }>(dst, val),
            Acquire => intrinsics::atomic_or::<T, U, { AO::Acquire }>(dst, val),
            Release => intrinsics::atomic_or::<T, U, { AO::Release }>(dst, val),
            AcqRel => intrinsics::atomic_or::<T, U, { AO::AcqRel }>(dst, val),
            Relaxed => intrinsics::atomic_or::<T, U, { AO::Relaxed }>(dst, val),
        }
    }
}

#[inline]
#[cfg(target_has_atomic)]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
#[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
const unsafe fn atomic_xor<T: Copy, U: Copy>(dst: *mut T, val: U, order: Ordering) -> T {
    // SAFETY: the caller must uphold the safety contract for `atomic_xor`
    unsafe {
        match order {
            SeqCst => intrinsics::atomic_xor::<T, U, { AO::SeqCst }>(dst, val),
            Acquire => intrinsics::atomic_xor::<T, U, { AO::Acquire }>(dst, val),
            Release => intrinsics::atomic_xor::<T, U, { AO::Release }>(dst, val),
            AcqRel => intrinsics::atomic_xor::<T, U, { AO::AcqRel }>(dst, val),
            Relaxed => intrinsics::atomic_xor::<T, U, { AO::Relaxed }>(dst, val),
        }
    }
}

/// Updates `*dst` to the max value of `val` and the old value (signed comparison)
#[inline]
#[cfg(target_has_atomic)]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
#[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
const unsafe fn atomic_max<T: Copy>(dst: *mut T, val: T, order: Ordering) -> T {
    // SAFETY: the caller must uphold the safety contract for `atomic_max`
    unsafe {
        match order {
            Relaxed => intrinsics::atomic_max::<T, { AO::Relaxed }>(dst, val),
            Acquire => intrinsics::atomic_max::<T, { AO::Acquire }>(dst, val),
            Release => intrinsics::atomic_max::<T, { AO::Release }>(dst, val),
            AcqRel => intrinsics::atomic_max::<T, { AO::AcqRel }>(dst, val),
            SeqCst => intrinsics::atomic_max::<T, { AO::SeqCst }>(dst, val),
        }
    }
}

/// Updates `*dst` to the min value of `val` and the old value (signed comparison)
#[inline]
#[cfg(target_has_atomic)]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
#[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
const unsafe fn atomic_min<T: Copy>(dst: *mut T, val: T, order: Ordering) -> T {
    // SAFETY: the caller must uphold the safety contract for `atomic_min`
    unsafe {
        match order {
            Relaxed => intrinsics::atomic_min::<T, { AO::Relaxed }>(dst, val),
            Acquire => intrinsics::atomic_min::<T, { AO::Acquire }>(dst, val),
            Release => intrinsics::atomic_min::<T, { AO::Release }>(dst, val),
            AcqRel => intrinsics::atomic_min::<T, { AO::AcqRel }>(dst, val),
            SeqCst => intrinsics::atomic_min::<T, { AO::SeqCst }>(dst, val),
        }
    }
}

/// Updates `*dst` to the max value of `val` and the old value (unsigned comparison)
#[inline]
#[cfg(target_has_atomic)]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
#[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
const unsafe fn atomic_umax<T: Copy>(dst: *mut T, val: T, order: Ordering) -> T {
    // SAFETY: the caller must uphold the safety contract for `atomic_umax`
    unsafe {
        match order {
            Relaxed => intrinsics::atomic_umax::<T, { AO::Relaxed }>(dst, val),
            Acquire => intrinsics::atomic_umax::<T, { AO::Acquire }>(dst, val),
            Release => intrinsics::atomic_umax::<T, { AO::Release }>(dst, val),
            AcqRel => intrinsics::atomic_umax::<T, { AO::AcqRel }>(dst, val),
            SeqCst => intrinsics::atomic_umax::<T, { AO::SeqCst }>(dst, val),
        }
    }
}

/// Updates `*dst` to the min value of `val` and the old value (unsigned comparison)
#[inline]
#[cfg(target_has_atomic)]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
#[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
const unsafe fn atomic_umin<T: Copy>(dst: *mut T, val: T, order: Ordering) -> T {
    // SAFETY: the caller must uphold the safety contract for `atomic_umin`
    unsafe {
        match order {
            Relaxed => intrinsics::atomic_umin::<T, { AO::Relaxed }>(dst, val),
            Acquire => intrinsics::atomic_umin::<T, { AO::Acquire }>(dst, val),
            Release => intrinsics::atomic_umin::<T, { AO::Release }>(dst, val),
            AcqRel => intrinsics::atomic_umin::<T, { AO::AcqRel }>(dst, val),
            SeqCst => intrinsics::atomic_umin::<T, { AO::SeqCst }>(dst, val),
        }
    }
}

/// An atomic fence.
///
/// Fences create synchronization between themselves and atomic operations or fences in other
/// threads. It can be helpful to think of a fence as preventing the compiler and CPU from
/// reordering certain types of memory operations around it, but that is a simplified model which
/// fails to capture some of the nuances.
///
/// There are 3 different ways to use an atomic fence:
///
/// - atomic - fence synchronization: an atomic operation with (at least) [`Release`] ordering
///   semantics synchronizes with a fence with (at least) [`Acquire`] ordering semantics.
/// - fence - atomic synchronization: a fence with (at least) [`Release`] ordering semantics
///   synchronizes with an atomic operation with (at least) [`Acquire`] ordering semantics.
/// - fence - fence synchronization: a fence with (at least) [`Release`] ordering semantics
///   synchronizes with a fence with (at least) [`Acquire`] ordering semantics.
///
/// These 3 ways complement the regular, fence-less, atomic - atomic synchronization.
///
/// ## Atomic - Fence
///
/// An atomic operation on one thread will synchronize with a fence on another thread when:
///
/// -   on thread 1:
///     -   an atomic operation 'X' with (at least) [`Release`] ordering semantics on some atomic
///         object 'm',
///
/// -   is paired on thread 2 with:
///     -   an atomic read 'Y' with any order on 'm',
///     -   followed by a fence 'B' with (at least) [`Acquire`] ordering semantics.
///
/// This provides a happens-before dependence between X and B.
///
/// ```text
/// 线程 1                                          线程 2
///
/// m.store(3, Release); X ---------
///                                |
///                                |
/// -------------> Y  if m.load(Relaxed) == 3 {
/// B      fence(Acquire);
///                                                      ...
///                                                  }
/// ```
///
/// ## Fence - Atomic
///
/// A fence on one thread will synchronize with an atomic operation on another thread when:
///
/// -   on thread:
///     -   a fence 'A' with (at least) [`Release`] ordering semantics,
///     -   followed by an atomic write 'X' with any ordering on some atomic object 'm',
///
/// -   is paired on thread 2 with:
///     -   an atomic operation 'Y' with (at least) [`Acquire`] ordering semantics.
///
/// This provides a happens-before dependence between A and Y.
///
/// ```text
/// 线程 1                                          线程 2
///
/// fence(Release);      A
/// m.store(3, Relaxed); X ---------
///                                |
///                                |
/// -------------> Y  if m.load(Acquire) == 3 {
///                                                      ...
///                                                  }
/// ```
///
/// ## Fence - Fence
///
/// A fence on one thread will synchronize with a fence on another thread when:
///
/// -   on thread 1:
///     -   a fence 'A' which has (at least) [`Release`] ordering semantics,
///     -   followed by an atomic write 'X' with any ordering on some atomic object 'm',
///
/// -   is paired on thread 2 with:
///     -   an atomic read 'Y' with any ordering on 'm',
///     -   followed by a fence 'B' with (at least) [`Acquire`] ordering semantics.
///
/// This provides a happens-before dependence between A and B.
///
/// ```text
/// 线程 1                                          线程 2
///
/// fence(Release);      A --------------
/// m.store(3, Relaxed); X ---------    |
///                                |    |
///                                |    |
/// -------------> Y  if m.load(Relaxed) == 3 {
/// |-------> B      fence(Acquire);
///                                                      ...
///                                                  }
/// ```
///
/// ## Mandatory Atomic
///
/// Note that in the examples above, it is crucial that the access to `m` are atomic. Fences cannot
/// be used to establish synchronization between non-atomic accesses in different threads. However,
/// thanks to the happens-before relationship, any non-atomic access that happen-before the atomic
/// operation or fence with (at least) [`Release`] ordering semantics are now also properly
/// synchronized with any non-atomic accesses that happen-after the atomic operation or fence with
/// (at least) [`Acquire`] ordering semantics.
///
/// ## Memory Ordering
///
/// A fence which has [`SeqCst`] ordering, in addition to having both [`Acquire`] and [`Release`]
/// semantics, participates in the global program order of the other [`SeqCst`] operations and/or
/// fences.
///
/// Accepts [`Acquire`], [`Release`], [`AcqRel`] and [`SeqCst`] orderings.
///
/// # Panics
///
/// Panics if `order` is [`Relaxed`].
///
/// # Examples
///
/// ```
/// use std::sync::atomic::AtomicBool;
/// 使用 std::sync::atomic::fence;
/// 使用 std::sync::atomic::Ordering;
///
/// // 基于自旋锁的互斥原语。
/// pub struct Mutex {
/// flag: AtomicBool,
/// }
///
/// 实现 Mutex {
/// pub fn new() -> Mutex {
/// Mutex {
/// flag: AtomicBool::new(false),
///         }
///     }
///
/// pub fn lock(&self) {
///         // Wait until the old value is `false`.
/// while self
/// .flag
/// .compare_exchange_weak(false, true, 生命周期::放松, 生命周期::放松)
/// .is_err()
///         {}
///         // This fence synchronizes-with store in `unlock`.
/// fence(生命周期::获取);
///     }
///
/// pub fn unlock(&self) {
/// self.flag.store(false, 生命周期::释放);
///     }
/// }
/// ```
#[inline]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
#[rustc_diagnostic_item = "fence"]
#[doc(alias = "atomic_thread_fence")]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
pub const fn fence(order: Ordering) {
    // SAFETY: using an atomic fence is safe.
    unsafe {
        match order {
            Acquire => intrinsics::atomic_fence::<{ AO::Acquire }>(),
            Release => intrinsics::atomic_fence::<{ AO::Release }>(),
            AcqRel => intrinsics::atomic_fence::<{ AO::AcqRel }>(),
            SeqCst => intrinsics::atomic_fence::<{ AO::SeqCst }>(),
            Relaxed => panic!("there is no such thing as a relaxed fence"),
        }
    }
}

/// An atomic fence for synchronization within a single thread.
///
/// Like [`fence`], this function establishes synchronization with other atomic operations and
/// fences. However, unlike [`fence`], `compiler_fence` only establishes synchronization with
/// operations *in the same thread*. This may at first sound rather useless, since code within a
/// thread is typically already totally ordered and does not need any further synchronization.
/// However, there are cases where code can run on the same thread without being synchronized:
/// - The most common case is that of a *signal handler*: a signal handler runs in the same thread
///   as the code it interrupted, but it is not synchronized with that code. `compiler_fence`
///   can be used to establish synchronization between a thread and its signal handler, the same way
///   that `fence` can be used to establish synchronization across threads.
/// - Similar situations can arise in embedded programming with interrupt handlers, or in custom
///   implementations of preemptive green threads. In general, `compiler_fence` can establish
///   synchronization with code that is guaranteed to run on the same hardware CPU.
///
/// See [`fence`] for how a fence can be used to achieve synchronization. Note that just like
/// [`fence`], synchronization still requires atomic operations to be used in both threads -- it is
/// not possible to perform synchronization entirely with fences and non-atomic operations.
///
/// `compiler_fence` does not emit any machine code. However, note that `compiler_fence` is also
/// *not* a "compiler barrier". It can be helpful to think of a `compiler_fence` as preventing the
/// compiler from reordering certain types of memory operations around it, but that is a simplified
/// model which fails to capture some of the nuances. The only actual guarantee made by
/// `compiler_fence` is establishing synchronization with signal handlers and similar kinds of code,
/// under the rules described in the [`fence`] documentation.
///
/// `compiler_fence` corresponds to [`atomic_signal_fence`] in C and C++.
///
/// [`atomic_signal_fence`]: https://en.cppreference.com/w/cpp/atomic/atomic_signal_fence
///
/// # Panics
///
/// Panics if `order` is [`Relaxed`].
///
/// # Examples
///
/// Without the two `compiler_fence` calls, the read of `IMPORTANT_VARIABLE` in `signal_handler`
/// is *undefined behavior* due to a data race, despite everything happening in a single thread.
/// This is because the signal handler is considered to run concurrently with its associated
/// thread, and explicit synchronization is required to pass data between a thread and its
/// signal handler. The code below uses two `compiler_fence` calls to establish the usual
/// release-acquire synchronization pattern (see [`fence`] for an image).
///
/// ```
/// 使用 std::sync::atomic::AtomicBool;
/// 使用 std::sync::atomic::Ordering;
/// 使用 std::sync::atomic::compiler_fence;
///
/// static mut 重要变量: usize = 0;
/// static 已准备: AtomicBool = AtomicBool::new(false);
///
/// fn main() {
/// unsafe { 重要变量 = 42 };
/// // 标记之前的写入为通过未来放松的存储被释放。
/// compiler_fence(生命周期::释放);
/// 已准备.store(true, 生命周期::放松);
/// }
///
/// fn signal_handler() {
/// if 已准备.load(生命周期::放松) {
/// // 获取通过放松的存储被释放的写入数据。
/// compiler_fence(生命周期::获取);
/// assert_eq!(unsafe { 重要变量 }, 42);
///     }
/// }
/// ```
#[inline]
#[stable(feature = "compiler_fences", since = "1.21.0")]
#[rustc_const_unstable(feature = "const_atomic", issue = "160078")]
#[rustc_diagnostic_item = "compiler_fence"]
#[doc(alias = "atomic_signal_fence")]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
pub const fn compiler_fence(order: Ordering) {
    // SAFETY: using an atomic fence is safe.
    unsafe {
        match order {
            Acquire => intrinsics::atomic_singlethreadfence::<{ AO::Acquire }>(),
            Release => intrinsics::atomic_singlethreadfence::<{ AO::Release }>(),
            AcqRel => intrinsics::atomic_singlethreadfence::<{ AO::AcqRel }>(),
            SeqCst => intrinsics::atomic_singlethreadfence::<{ AO::SeqCst }>(),
            Relaxed => panic!("there is no such thing as a relaxed fence"),
        }
    }
}

#[cfg(target_has_atomic_load_store = "8")]
#[stable(feature = "atomic_debug", since = "1.3.0")]
impl fmt::Debug for AtomicBool {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Debug::fmt(&self.load(Ordering::Relaxed), f)
    }
}

#[cfg(target_has_atomic_load_store = "ptr")]
#[stable(feature = "atomic_debug", since = "1.3.0")]
impl<T> fmt::Debug for AtomicPtr<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Debug::fmt(&self.load(Ordering::Relaxed), f)
    }
}

#[cfg(target_has_atomic_load_store = "ptr")]
#[stable(feature = "atomic_pointer", since = "1.24.0")]
impl<T> fmt::Pointer for AtomicPtr<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Pointer::fmt(&self.load(Ordering::Relaxed), f)
    }
}

/// Signals the processor that it is inside a busy-wait spin-loop ("spin lock").
///
/// This function is deprecated in favor of [`hint::spin_loop`].
///
/// [`hint::spin_loop`]: crate::hint::spin_loop
#[inline]
#[stable(feature = "spin_loop_hint", since = "1.24.0")]
#[deprecated(since = "1.51.0", note = "use hint::spin_loop instead")]
pub fn spin_loop_hint() {
    spin_loop()
}
