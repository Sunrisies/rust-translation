//! 编译器内建功能。
//!
//! The functions in this module are implementation details of `core` and should
//! 在标准库之外使用。我们通常通过稳定的包装函数提供对这些功能的访问。请使用这些函数。
//! 这些内建功能是通过稳定包装函数实现的。请使用它们。
//!
//! 这些是使内建功能可供 Rust 代码使用的导入项。实际实现位于编译器中。
//! Some of these intrinsics are lowered to MIR in <https://github.com/rust-lang/rust/blob/HEAD/compiler/rustc_mir_transform/src/lower_intrinsics.rs>.
//! The remaining intrinsics are implemented for the LLVM backend in <https://github.com/rust-lang/rust/blob/HEAD/compiler/rustc_codegen_ssa/src/mir/intrinsic.rs>
//! and <https://github.com/rust-lang/rust/blob/HEAD/compiler/rustc_codegen_llvm/src/intrinsic.rs>,
//! and for const evaluation in <https://github.com/rust-lang/rust/blob/HEAD/compiler/rustc_const_eval/src/interpret/intrinsics.rs>.
//!
//! 内建功能不需要主体。不过，它们可以可选地拥有主体，我们称之为
//! “回退主体”。未被专门实现的代码生成后端会使用此主体，从而便于为特定操作添加新的内建功能，而无需在每个代码生成后端中实现它们。显然，回退主体必须
//! 是内建功能的规范文档的有效实现。在某些情况下，
//! without having to implement them in each codegen backend. The fallback body obviously has to be
//! a valid implementation of the documented specification of the intrinsic. In some cases, the
//! fallback body will be *equivalent* to the specification. Note that this is a strong requirement:
//! if the spec says "UB if input `x` is even", then a valid implementation can just ignore this and
//! do whatever it wants in that case; an *equivalent* implementation needs to actually check this
//! condition and trigger UB in that case (e.g. by using `hint::assert_unchecked()`). Similar, if
//! the spec says "returns `x` or `y` non-deterministically", then an *equivalent* implementation
//! t-lang 应参与其中。然而，如果某个内建功能被标记为
//! language operation that has the same non-determinism). Intrinsics with such a fallback body that
//! is equivalent to the spec may be marked with `#[miri::intrinsic_fallback_is_spec]`; the fallback
//! body will then also be used by Miri for UB checking. When in doubt, do not use this attribute or
//! ask the Miri maintainers for advice.
//!
//! Intrinsics are, in general, language extensions. Therefore, t-lang should be involved whenever a
//! new intrinsic is exposed to stable code. However, if an intrinsic is marked
//! `#[miri::intrinsic_fallback_is_spec]` with a fallback body that only uses stable features (or if
//! such a fallback body could be written, but for one reason or another the actual fallback body is
//! different), and if it also does not make other promises that go beyond observable program
//! 如果行为（例如将优化器引导到特定方向）需要由 intrinsic 实现，那么就可以使用该 intrinsic。
//! 无需 T-lang 参与即可使用。
//!
//! # Const intrinsics
//!
//! 为了使 intrinsic 在编译时可用且不稳定，需从
//! <https://github.com/rust-lang/miri/blob/master/src/intrinsics> to
//! <https://github.com/rust-lang/rust/blob/HEAD/compiler/rustc_const_eval/src/interpret/intrinsics.rs>
//! and make the intrinsic declaration below a `const fn`. This should be done in coordination with
//! 进行。
//!
//! If an intrinsic is supposed to be used from a `const fn` with a `rustc_const_stable` attribute,
//! `#[rustc_intrinsic_const_stable_indirect]` needs to be added to the intrinsic. Such a change
//! 需要 T-lang 批准，因为可能会将某个特性嵌入语言中，而该特性无法
//! 在用户代码中复制，且不需要编译器支持。上述同样的例外也适用于
//! `#[miri::intrinsic_fallback_is_spec]` intrinsics.
//!
//! # Volatiles
//!
//! Volatile intrinsic 提供用于 I/O
//! memory, which are guaranteed to not be reordered by the compiler
//! across other volatile intrinsics. See [`read_volatile`][ptr::read_volatile]
//! and [`write_volatile`][ptr::write_volatile].
//!
//! # Atomic intrinsic 提供对机器字的常见原子操作，
//!
//! 具有多种可能的内存顺序。详情请参阅 [atomic types][atomic] 文档。
//! # Unwinding
//! [atomic types][atomic] docs for details.
//!
//! # 然而，即使是可以反汇编的 intrinsic，rustc 也假设 Rust intrinsic 永远不会
//!
//! 触发外部（非 Rust）反汇编，因此对于 panic=abort 情况，我们始终可以假设这些
//! `#[rustc_nounwind]` attribute so that the compiler can make use of this fact.
//!
//! However, even for intrinsics that may unwind, rustc assumes that a Rust intrinsics will never
//! 导致数据泄露到稳定代码中。
//! intrinsics cannot unwind.

#![unstable(
    feature = "core_intrinsics",
    reason = "intrinsics are unlikely to ever be stabilized, instead \
                      they should be used through stabilized interfaces \
                      in the rest of the standard library",
    issue = "none"
)]

use crate::ffi::{VaArgSafe, VaList};
use crate::marker::{ConstParamTy, DiscriminantKind, PointeeSized, Tuple};
use crate::num::imp::libm;
use crate::{mem, ptr};

mod bounds;
pub mod fallback;
pub mod gpu;
mod macros;
pub mod mir;
pub mod reflection;
pub mod simd;

use macros::intrinsic_dispatch_on_type;

// These imports are used for simplifying intra-doc links
#[allow(unused_imports)]
#[cfg(all(target_has_atomic = "8", target_has_atomic = "32", target_has_atomic = "ptr"))]
use crate::sync::atomic::{
    self, AtomicBool, AtomicI32, AtomicIsize, AtomicPtr, AtomicU32, Ordering,
};

/// A type for atomic ordering parameters for intrinsics. This is a separate type from
/// `atomic::Ordering` so that we can make it `ConstParamTy` and fix the values used here without a
/// risk of leaking that to stable code.
#[derive(Debug, ConstParamTy, PartialEq, Eq)]
pub enum AtomicOrdering {
    // These values must match the compiler's `AtomicOrdering` defined in
    // `rustc_middle/src/ty/consts/int.rs`!
    /// [`Ordering::Relaxed`][`crate::sync::atomic::Ordering::Relaxed`]
    Relaxed = 0,
    /// [`Ordering::Release`][`crate::sync::atomic::Ordering::Release`]
    Release = 1,
    /// [`Ordering::Acquire`][`crate::sync::atomic::Ordering::Acquire`]
    Acquire = 2,
    /// [`Ordering::AcqRel`][`crate::sync::atomic::Ordering::AcqRel`]
    AcqRel = 3,
    /// [`Ordering::SeqCst`][`crate::sync::atomic::Ordering::SeqCst`]
    SeqCst = 4,
}

// N.B., these intrinsics take raw pointers because they mutate aliased
// memory, which is not valid for either `&` or `&mut`.

/// Stores a value if the current value is the same as the `old` value,
/// with the returned `T` being the previous value and the returned `bool` being
/// 交换是否成功。
/// `T` must be an integer or pointer type.
///
/// # Safety
///
/// * If `T` is an integer type, this is equivalent to [`Atomic<T>::from_ptr`] followed by [`Atomic<T>::compare_exchange`].
///   Refer to the documentation of [`Atomic<T>::from_ptr`] for safety requirements.
///
/// * If `T` is a pointer type, this is equivalent to [`AtomicPtr<P>::from_ptr`] followed by [`AtomicPtr<P>::compare_exchange`],
///   where `P` is the pointee type of the pointer.
///   Refer to the documentation of [`AtomicPtr<P>::from_ptr`] for safety requirements.
///
/// The stabilized version of this intrinsic is available on the
/// [`atomic`] types via the `compare_exchange` method.
/// For example, [`AtomicBool::compare_exchange`].
///
/// [`Atomic<T>::from_ptr`]: AtomicI32::from_ptr
/// [`Atomic<T>::compare_exchange`]: AtomicI32::compare_exchange
/// [`AtomicPtr<P>::from_ptr`]: AtomicPtr::from_ptr
/// [`AtomicPtr<P>::compare_exchange`]: AtomicPtr::compare_exchange
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn atomic_cxchg<
    T: Copy,
    const ORD_SUCC: AtomicOrdering,
    const ORD_FAIL: AtomicOrdering,
>(
    dst: *mut T,
    old: T,
    src: T,
) -> (T, bool);

/// Stores a value if the current value is the same as the `old` value,
/// with the returned `T` being the previous value and the returned `bool` being
/// 交换是否成功。
/// `T` must be an integer or pointer type. The comparison may spuriously fail.
///
/// # 安全性
///
/// * If `T` is an integer type, this is equivalent to [`Atomic<T>::from_ptr`] followed by [`Atomic<T>::compare_exchange_weak`].
///   Refer to the documentation of [`Atomic<T>::from_ptr`] for safety requirements.
///
/// * If `T` is a pointer type, this is equivalent to [`AtomicPtr<P>::from_ptr`] followed by [`AtomicPtr<P>::compare_exchange_weak`],
///   where `P` is the pointee type of the pointer.
///   Refer to the documentation of [`AtomicPtr<P>::from_ptr`] for safety requirements.
///
/// 此内建函数的稳定版本可通过
/// [`atomic`] types via the `compare_exchange_weak` method.
/// For example, [`AtomicBool::compare_exchange_weak`].
///
/// [`Atomic<T>::from_ptr`]: AtomicI32::from_ptr
/// [`Atomic<T>::compare_exchange_weak`]: AtomicI32::compare_exchange_weak
/// [`AtomicPtr<P>::from_ptr`]: AtomicPtr::from_ptr
/// [`AtomicPtr<P>::compare_exchange_weak`]: AtomicPtr::compare_exchange_weak
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn atomic_cxchgweak<
    T: Copy,
    const ORD_SUCC: AtomicOrdering,
    const ORD_FAIL: AtomicOrdering,
>(
    _dst: *mut T,
    _old: T,
    _src: T,
) -> (T, bool);

/// 加载指针当前的值。
/// `T` must be an integer or pointer type.
///
/// # 安全性
///
/// * If `VOLATILE` is `true`, this is equivalent to [`Atomic<T>::load_volatile`].
/// 请参阅该方法的文档以了解安全性要求。
///
/// * If `VOLATILE` is `false`, this is equivalent to [`Atomic<T>::from_ptr`] followed
///   by [`Atomic<T>::load`]. Refer to the documentation of [`Atomic<T>::from_ptr`] for safety requirements.
///
/// 此内建函数的稳定版本可通过
/// [`atomic`] types via the `load` method. For example, [`AtomicBool::load`].
///
/// [`Atomic<T>::load_volatile`]: AtomicI32::load_volatile
/// [`Atomic<T>::from_ptr`]: AtomicI32::from_ptr
/// [`Atomic<T>::load`]: AtomicI32::load
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn atomic_load<T: Copy, const ORD: AtomicOrdering, const VOLATILE: bool>(
    src: *const T,
) -> T;

/// 将指定内存位置的值存储起来。
/// `T` must be an integer or pointer type.
///
/// # 安全性
///
/// * If `VOLATILE` is `true`, this is equivalent to [`Atomic<T>::store_volatile`].
/// 请参阅该方法的文档以了解安全性要求。
///
/// * If `VOLATILE` is `false`, this is equivalent to [`Atomic<T>::from_ptr`] followed
///   by [`Atomic<T>::store`]. Refer to the documentation of [`Atomic<T>::from_ptr`] for safety requirements.
///
/// 此内建函数的稳定版本可通过
/// [`atomic`] types via the `store` method. For example, [`AtomicBool::store`].
///
/// [`Atomic<T>::store_volatile`]: AtomicI32::store_volatile
/// [`Atomic<T>::from_ptr`]: AtomicI32::from_ptr
/// [`Atomic<T>::store`]: AtomicI32::store
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn atomic_store<T: Copy, const ORD: AtomicOrdering, const VOLATILE: bool>(
    dst: *mut T,
    val: T,
);

/// 将指定内存位置的值存储起来，并返回旧值。
/// `T` must be an integer or pointer type.
///
/// # 安全性
///
/// * If `T` is an integer type, this is equivalent to [`Atomic<T>::from_ptr`] followed by [`Atomic<T>::swap`].
///   Refer to the documentation of [`Atomic<T>::from_ptr`] for safety requirements.
///
/// * If `T` is a pointer type, this is equivalent to [`AtomicPtr<P>::from_ptr`] followed by [`AtomicPtr<P>::swap`],
///   where `P` is the pointee type of the pointer.
///   Refer to the documentation of [`AtomicPtr<P>::from_ptr`] for safety requirements.
///
/// The stabilized version of this intrinsic is available on the
/// [`atomic`] types via the `swap` method. For example, [`AtomicBool::swap`].
///
/// [`Atomic<T>::from_ptr`]: AtomicI32::from_ptr
/// [`Atomic<T>::swap`]: AtomicI32::swap
/// [`AtomicPtr<P>::from_ptr`]: AtomicPtr::from_ptr
/// [`AtomicPtr<P>::swap`]: AtomicPtr::swap
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn atomic_xchg<T: Copy, const ORD: AtomicOrdering>(dst: *mut T, src: T) -> T;

/// 将当前值加上该值，返回之前的值。
/// `T` must be an integer or pointer type.
/// `U` must be the same as `T` if that is an integer type, or `usize` if `T` is a pointer type.
///
/// # 安全性
///
/// * If `T` is an integer type, this is equivalent to [`Atomic<T>::from_ptr`] followed by [`Atomic<T>::fetch_add`].
///   Refer to the documentation of [`Atomic<T>::from_ptr`] for safety requirements.
///
/// * If `T` is a pointer type, this is equivalent to [`AtomicPtr<P>::from_ptr`] followed by [`AtomicPtr<P>::fetch_byte_add`],
///   where `P` is the pointee type of the pointer.
///   Refer to the documentation of [`AtomicPtr<P>::from_ptr`] for safety requirements.
///
/// The stabilized version of this intrinsic is available on the
/// [`atomic`] types via the `fetch_add` method. For example, [`AtomicIsize::fetch_add`].
///
/// [`Atomic<T>::from_ptr`]: AtomicI32::from_ptr
/// [`Atomic<T>::fetch_add`]: AtomicI32::fetch_add
/// [`AtomicPtr<P>::from_ptr`]: AtomicPtr::from_ptr
/// [`AtomicPtr<P>::fetch_byte_add`]: AtomicPtr::fetch_byte_add
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn atomic_xadd<T: Copy, U: Copy, const ORD: AtomicOrdering>(
    dst: *mut T,
    src: U,
) -> T;

/// 从当前值中减去该值，返回之前的值。
/// `T` must be an integer or pointer type.
/// `U` must be the same as `T` if that is an integer type, or `usize` if `T` is a pointer type.
///
/// # 安全性
///
/// * If `T` is an integer type, this is equivalent to [`Atomic<T>::from_ptr`] followed by [`Atomic<T>::fetch_sub`].
///   Refer to the documentation of [`Atomic<T>::from_ptr`] for safety requirements.
///
/// * If `T` is a pointer type, this is equivalent to [`AtomicPtr<P>::from_ptr`] followed by [`AtomicPtr<P>::fetch_byte_sub`],
///   where `P` is the pointee type of the pointer.
///   Refer to the documentation of [`AtomicPtr<P>::from_ptr`] for safety requirements.
///
/// 此内建函数的稳定版本可通过
/// [`atomic`] types via the `fetch_sub` method. For example, [`AtomicIsize::fetch_sub`].
///
/// [`Atomic<T>::from_ptr`]: AtomicI32::from_ptr
/// [`Atomic<T>::fetch_sub`]: AtomicI32::fetch_sub
/// [`AtomicPtr<P>::from_ptr`]: AtomicPtr::from_ptr
/// [`AtomicPtr<P>::fetch_byte_sub`]: AtomicPtr::fetch_byte_sub
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn atomic_xsub<T: Copy, U: Copy, const ORD: AtomicOrdering>(
    dst: *mut T,
    src: U,
) -> T;

/// 与当前值进行位运算，返回之前的值。
/// `T` must be an integer or pointer type.
/// `U` must be the same as `T` if that is an integer type, or `usize` if `T` is a pointer type.
///
/// # 安全性
///
/// * If `T` is an integer type, this is equivalent to [`Atomic<T>::from_ptr`] followed by [`Atomic<T>::fetch_and`].
///   Refer to the documentation of [`Atomic<T>::from_ptr`] for safety requirements.
///
/// * If `T` is a pointer type, this is equivalent to [`AtomicPtr<P>::from_ptr`] followed by [`AtomicPtr<P>::fetch_and`],
///   where `P` is the pointee type of the pointer.
///   Refer to the documentation of [`AtomicPtr<P>::from_ptr`] for safety requirements.
///
/// The stabilized version of this intrinsic is available on the
/// [`atomic`] types via the `fetch_and` method. For example, [`AtomicBool::fetch_and`].
///
/// [`Atomic<T>::from_ptr`]: AtomicI32::from_ptr
/// [`Atomic<T>::fetch_and`]: AtomicI32::fetch_and
/// [`AtomicPtr<P>::from_ptr`]: AtomicPtr::from_ptr
/// [`AtomicPtr<P>::fetch_and`]: AtomicPtr::fetch_and
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn atomic_and<T: Copy, U: Copy, const ORD: AtomicOrdering>(
    dst: *mut T,
    src: U,
) -> T;

/// Bitwise nand with the current value, returning the previous value.
/// `T` must be an integer or pointer type.
/// `U` must be the same as `T` if that is an integer type, or `usize` if `T` is a pointer type.
///
/// # 安全性
///
/// This is equivalent to [`Atomic<T>::from_ptr`] followed by [`Atomic<T>::fetch_nand`].
/// Refer to the documentation of [`Atomic<T>::from_ptr`] for safety requirements.
///
/// The stabilized version of this intrinsic is available on the
/// [`atomic`] types via the `fetch_nand` method. For example, [`AtomicBool::fetch_nand`].
///
/// [`Atomic<T>::from_ptr`]: AtomicI32::from_ptr
/// [`Atomic<T>::fetch_nand`]: AtomicI32::fetch_nand
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn atomic_nand<T: Copy, U: Copy, const ORD: AtomicOrdering>(
    dst: *mut T,
    src: U,
) -> T;

/// 位运算或与当前值进行非与操作，返回之前的值。
/// `T` must be an integer or pointer type.
/// `U` must be the same as `T` if that is an integer type, or `usize` if `T` is a pointer type.
///
/// # 安全性
///
/// * If `T` is an integer type, this is equivalent to [`Atomic<T>::from_ptr`] followed by [`Atomic<T>::fetch_or`].
///   Refer to the documentation of [`Atomic<T>::from_ptr`] for safety requirements.
///
/// * If `T` is a pointer type, this is equivalent to [`AtomicPtr<P>::from_ptr`] followed by [`AtomicPtr<P>::fetch_or`],
///   where `P` is the pointee type of the pointer.
///   Refer to the documentation of [`AtomicPtr<P>::from_ptr`] for safety requirements.
///
/// The stabilized version of this intrinsic is available on the
/// [`atomic`] types via the `fetch_or` method. For example, [`AtomicBool::fetch_or`].
///
/// [`Atomic<T>::from_ptr`]: AtomicI32::from_ptr
/// [`Atomic<T>::fetch_or`]: AtomicI32::fetch_or
/// [`AtomicPtr<P>::from_ptr`]: AtomicPtr::from_ptr
/// [`AtomicPtr<P>::fetch_or`]: AtomicPtr::fetch_or
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn atomic_or<T: Copy, U: Copy, const ORD: AtomicOrdering>(
    dst: *mut T,
    src: U,
) -> T;

/// 位运算与当前值进行异或操作，返回之前的值。
/// `T` must be an integer or pointer type.
/// `U` must be the same as `T` if that is an integer type, or `usize` if `T` is a pointer type.
///
/// # 安全性
///
/// * If `T` is an integer type, this is equivalent to [`Atomic<T>::from_ptr`] followed by [`Atomic<T>::fetch_xor`].
///   Refer to the documentation of [`Atomic<T>::from_ptr`] for safety requirements.
///
/// * If `T` is a pointer type, this is equivalent to [`AtomicPtr<P>::from_ptr`] followed by [`AtomicPtr<P>::fetch_xor`],
///   where `P` is the pointee type of the pointer.
///   Refer to the documentation of [`AtomicPtr<P>::from_ptr`] for safety requirements.
///
/// The stabilized version of this intrinsic is available on the
/// [`atomic`] types via the `fetch_xor` method. For example, [`AtomicBool::fetch_xor`].
///
/// [`Atomic<T>::from_ptr`]: AtomicI32::from_ptr
/// [`Atomic<T>::fetch_xor`]: AtomicI32::fetch_xor
/// [`AtomicPtr<P>::from_ptr`]: AtomicPtr::from_ptr
/// [`AtomicPtr<P>::fetch_xor`]: AtomicPtr::fetch_xor
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn atomic_xor<T: Copy, U: Copy, const ORD: AtomicOrdering>(
    dst: *mut T,
    src: U,
) -> T;

/// 使用有符号比较与当前值进行最大值比较。
/// `T` must be a signed integer type.
///
/// # 安全性
///
/// This is equivalent to [`Atomic<T>::from_ptr`] followed by [`Atomic<T>::fetch_max`].
/// Refer to the documentation of [`Atomic<T>::from_ptr`] for safety requirements.
///
/// 此内建函数的稳定版本已可在...
/// [`atomic`] signed integer types via the `fetch_max` method. For example, [`AtomicI32::fetch_max`].
///
/// [`Atomic<T>::from_ptr`]: AtomicI32::from_ptr
/// [`Atomic<T>::fetch_max`]: AtomicI32::fetch_max
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn atomic_max<T: Copy, const ORD: AtomicOrdering>(dst: *mut T, src: T) -> T;

/// 使用有符号比较得到当前值的最小值。
/// `T` must be a signed integer type.
///
/// # 安全性
///
/// This is equivalent to [`Atomic<T>::from_ptr`] followed by [`Atomic<T>::fetch_min`].
/// Refer to the documentation of [`Atomic<T>::from_ptr`] for safety requirements.
///
/// 此内建函数的稳定版本已可在...
/// [`atomic`] signed integer types via the `fetch_min` method. For example, [`AtomicI32::fetch_min`].
///
/// [`Atomic<T>::from_ptr`]: AtomicI32::from_ptr
/// [`Atomic<T>::fetch_min`]: AtomicI32::fetch_min
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn atomic_min<T: Copy, const ORD: AtomicOrdering>(dst: *mut T, src: T) -> T;

/// 使用无符号比较得到当前值的最小值。
/// `T` must be an unsigned integer type.
///
/// # 安全性
///
/// This is equivalent to [`Atomic<T>::from_ptr`] followed by [`Atomic<T>::fetch_min`].
/// Refer to the documentation of [`Atomic<T>::from_ptr`] for safety requirements.
///
/// 此内建函数的稳定版本已可在...
/// [`atomic`] unsigned integer types via the `fetch_min` method. For example, [`AtomicU32::fetch_min`].
///
/// [`Atomic<T>::from_ptr`]: AtomicU32::from_ptr
/// [`Atomic<T>::fetch_min`]: AtomicU32::fetch_min
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn atomic_umin<T: Copy, const ORD: AtomicOrdering>(dst: *mut T, src: T) -> T;

/// 使用无符号比较得到当前值的最大值。
/// `T` must be an unsigned integer type.
///
/// # 安全性
///
/// This is equivalent to [`Atomic<T>::from_ptr`] followed by [`Atomic<T>::fetch_max`].
/// Refer to the documentation of [`Atomic<T>::from_ptr`] for safety requirements.
///
/// 此内建函数的稳定版本已可在...
/// [`atomic`] unsigned integer types via the `fetch_max` method. For example, [`AtomicU32::fetch_max`].
///
/// [`Atomic<T>::from_ptr`]: AtomicU32::from_ptr
/// [`Atomic<T>::fetch_max`]: AtomicU32::fetch_max
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn atomic_umax<T: Copy, const ORD: AtomicOrdering>(dst: *mut T, src: T) -> T;

/// 一个原子屏障。
///
/// 此内建函数的稳定版本已可在...
/// [`atomic::fence`].
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn atomic_fence<const ORD: AtomicOrdering>();

/// 用于单个线程内的同步原子屏障。
///
/// 此内建函数的稳定版本已可在...
/// [`atomic::compiler_fence`].
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn atomic_singlethreadfence<const ORD: AtomicOrdering>();

/// The `prefetch` intrinsic is a hint to the code generator to insert a prefetch instruction
/// 预取对程序行为没有影响，但可以改变其性能特性。
/// 预取对程序行为没有影响，但可以改变其性能特性。
/// characteristics.
///
/// The `LOCALITY` argument is a temporal locality specifier ranging from (0) - no locality,
/// 此内建函数没有稳定的对应物。
///
/// This intrinsic does not have a stable counterpart.
#[rustc_intrinsic]
#[rustc_nounwind]
#[miri::intrinsic_fallback_is_spec]
pub const fn prefetch_read_data<T, const LOCALITY: i32>(data: *const T) {
    // This operation is a no-op, unless it is overridden by the backend.
    let _ = data;
}

/// The `prefetch` intrinsic is a hint to the code generator to insert a prefetch instruction
/// 预取对程序行为没有影响，但可以改变其性能特性。
/// Prefetches have no effect on the behavior of the program but can change its performance
/// characteristics.
///
/// The `LOCALITY` argument is a temporal locality specifier ranging from (0) - no locality,
/// to (3) - 极局部地保留在缓存中。
///
/// 此内建函数没有稳定的对应项。
#[rustc_intrinsic]
#[rustc_nounwind]
#[miri::intrinsic_fallback_is_spec]
pub const fn prefetch_write_data<T, const LOCALITY: i32>(data: *const T) {
    // This operation is a no-op, unless it is overridden by the backend.
    let _ = data;
}

/// The `prefetch` intrinsic is a hint to the code generator to insert a prefetch instruction
/// 如果支持，则针对给定地址执行；否则，无操作。
/// 预取对程序行为没有影响，但可能改变其性能。
/// 特性。
///
/// The `LOCALITY` argument is a temporal locality specifier ranging from (0) - no locality,
/// to (3) - 极局部地保留在缓存中。
///
/// 此内建函数没有稳定的对应项。
#[rustc_intrinsic]
#[rustc_nounwind]
#[miri::intrinsic_fallback_is_spec]
pub const fn prefetch_read_instruction<T, const LOCALITY: i32>(data: *const T) {
    // This operation is a no-op, unless it is overridden by the backend.
    let _ = data;
}

/// The `prefetch` intrinsic is a hint to the code generator to insert a prefetch instruction
/// 如果支持，则针对给定地址执行；否则，无操作。
/// 预取对程序行为没有影响，但可能改变其性能。
/// 特性。
///
/// The `LOCALITY` argument is a temporal locality specifier ranging from (0) - no locality,
/// to (3) - 极局部地保留在缓存中。
///
/// 此内建函数没有稳定的对应项。
#[rustc_intrinsic]
#[rustc_nounwind]
#[miri::intrinsic_fallback_is_spec]
pub const fn prefetch_write_instruction<T, const LOCALITY: i32>(data: *const T) {
    // This operation is a no-op, unless it is overridden by the backend.
    let _ = data;
}

/// 执行断点陷阱，供调试器检查。
///
/// The public version of this intrinsic is [`core::arch::breakpoint`].
#[rustc_intrinsic]
#[rustc_nounwind]
pub fn breakpoint();

/// 执行断点陷阱，供调试器检查。此操作允许进程继续运行。
///
/// The public version of this intrinsic is [`core::process::resumable_breakpoint`].
#[rustc_intrinsic]
#[rustc_nounwind]
#[miri::intrinsic_fallback_is_spec]
pub const fn resumable_breakpoint() {}

/// A container for the string arguments passed to [`codeview_annotation`].
#[unstable(feature = "codeview_annotation", issue = "163964")]
pub trait CodeViewAnnotationArgs {
    /// The string arguments to `codeview_annotation`.
    const ARGS: &[&str];
}

/// Emits a call to [`llvm.codeview.annotation`](https://llvm.org/docs/LangRef.html#llvm-codeview-annotation-intrinsic)
/// which results in [`CodeViewAnnotationArgs::ARGS`] being written to the
/// PDB as an `S_ANNOTATION` record.
///
/// 仅适用于使用 PDB 调试信息及 LLVM 后端的目标。
/// 在其他目标和后端上无操作。
#[rustc_intrinsic]
#[rustc_nounwind]
#[miri::intrinsic_fallback_is_spec]
pub fn codeview_annotation<T: CodeViewAnnotationArgs>() {
    // const block to catch any errors in `T::ARGS`
    const {
        let _ignore = T::ARGS;
    }
}

/// 从属性中派生意义的魔法内建函数。
/// 附加到函数上。
///
/// 例如，数据流使用此函数来注入静态断言，
/// that `rustc_peek(potentially_uninitialized)` would actually
/// 再次确认数据流确实计算出在控制流中的该时刻
/// 未初始化。
///
/// 此内建函数不应在编译器之外使用。
#[rustc_nounwind]
#[rustc_intrinsic]
pub fn rustc_peek<T>(_: T) -> T;

/// 无优雅地中止进程的执行。
///
/// This is the intrinsic for directly implementing [`core::process::crash`] which, on most
/// 平台上，会调用无效指令。在 Unix 系统上，进程可能会以
/// a signal like `SIGABRT`, `SIGILL`, `SIGTRAP`, `SIGSEGV` or `SIGBUS`. The precise behavior is not
/// 确定且不稳定。
///
/// [`std::process::abort`](../../std/process/fn.abort.html) is to be preferred if possible,
/// 因为其行为更易于使用且更稳定。
///
/// Note that, unlike most intrinsics, this is safe to call; it does not require an `unsafe` block.
/// 因此，实现不得要求用户遵守任何安全不变量。
///
/// The stabilized version of this intrinsic is [`core::process::crash`].
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn abort_immediate() -> !;

/// 通知优化器代码中的该点不可达，
/// 从而允许进一步优化。
///
/// N.B., this is very different from the `unreachable!()` macro: Unlike the
/// 宏不同，后者在执行时会触发 panic，而此情况属于 *未定义行为*，
/// 无法访问标有此函数的代码。
///
/// The stabilized version of this intrinsic is [`core::hint::unreachable_unchecked`].
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const unsafe fn unreachable() -> !;

/// 通知优化器某个条件始终为真。
/// 如果条件为假，其行为未定义。
///
/// 此内联函数不会生成任何代码，但优化器会尝试
/// 在不同迭代之间保留它及其条件，这可能会干扰
/// 周围代码的优化并降低性能。如果优化器能够自行发现该不变量，
/// 或者该不变量无法带来显著优化，则不应使用此函数。
/// own, or if it does not enable any significant optimizations.
///
/// The stabilized version of this intrinsic is [`core::hint::assert_unchecked`].
#[rustc_nounwind]
#[rustc_intrinsic]
pub const unsafe fn assume(b: bool) {
    if !b {
        // SAFETY: the caller must guarantee the argument is never `false`
        unsafe { unreachable() }
    }
}

/// 请注意，与大多数内联函数不同，调用此函数是安全的；
///
/// Note that, unlike most intrinsics, this is safe to call;
/// it does not require an `unsafe` block.
/// 所以，实现不得要求用户遵守任何安全不变量。
/// any safety invariants.
///
/// The stabilized version of this intrinsic is [`core::hint::cold_path`].
#[rustc_intrinsic]
#[rustc_nounwind]
#[miri::intrinsic_fallback_is_spec]
#[cold]
pub const fn cold_path() {}

/// 返回传递给它的值。
/// Returns the value passed to it.
///
/// Any use other than with `if` statements will probably not have an effect.
///
/// Note that, unlike most intrinsics, this is safe to call;
/// it does not require an `unsafe` block.
/// 所以，实现不得要求用户遵守任何安全不变量。
/// 此内联函数没有稳定的对应版本。
///
/// 此内联函数没有稳定的对应版本。
#[rustc_nounwind]
#[inline(always)]
pub const fn likely(b: bool) -> bool {
    if b {
        true
    } else {
        cold_path();
        false
    }
}

/// 向编译器提示分支条件很可能为假。
/// 返回传递给它的值。
///
/// Any use other than with `if` statements will probably not have an effect.
///
/// 请注意，与大多数内联函数不同，调用此函数是安全的；
/// it does not require an `unsafe` block.
/// 所以，实现不得要求用户遵守任何安全不变量。
/// 此内联函数没有稳定的对应版本。
///
/// This intrinsic does not have a stable counterpart.
#[rustc_nounwind]
#[inline(always)]
pub const fn unlikely(b: bool) -> bool {
    if b {
        cold_path();
        true
    } else {
        false
    }
}

/// Returns either `true_val` or `false_val` depending on condition `b` with a
/// 并向编译器提示该条件很可能无法正确判断。
/// 由 CPU 的分支预测器预测（例如二分查找）。
///
/// This is otherwise functionally equivalent to `if b { true_val } else { false_val }`.
///
/// 注意，与大多数内联函数不同，调用此函数是安全的；
/// it does not require an `unsafe` block.
/// 因此，实现不得要求用户遵守任何安全不变量。
/// any safety invariants.
///
/// The public form of this intrinsic is [`core::hint::select_unpredictable`].
/// However unlike the public form, the intrinsic will not drop the value that
/// is not selected.
#[rustc_const_unstable(feature = "core_intrinsics", issue = "none")]
#[rustc_intrinsic]
#[rustc_nounwind]
#[miri::intrinsic_fallback_is_spec]
#[inline]
pub const fn select_unpredictable<T>(b: bool, true_val: T, false_val: T) -> T {
    if b {
        forget(false_val);
        true_val
    } else {
        forget(true_val);
        false_val
    }
}

/// A guard for unsafe functions that cannot ever be executed if `T` is uninhabited:
/// 此内联函数没有稳定的对应实现。
/// and should only be called if an assertion failure will imply language UB in the following code.
///
/// 会引发 panic，且只有在以下代码中断言失败会导致语言 UB 时才应调用。
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn assert_inhabited<T>();

/// A guard for unsafe functions that cannot ever be executed if `T` does not permit
/// zero-initialization: This will statically either panic, or do nothing. It does not *guarantee*
/// 会引发 panic，且只有在以下代码中断言失败会导致语言 UB 时才应调用。
/// 此内联函数没有稳定的对应实现。
///
/// 此内联函数没有稳定的对应实现。
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn assert_zero_valid<T>();

/// A guard for `std::mem::uninitialized`. This will statically either panic, or do nothing. It does
/// 会引发 panic，且只有在以下代码中断言失败会导致语言 UB 时才应调用。
/// 此内联函数没有稳定的对应实现。
///
/// 此内联函数没有稳定的对应实现。
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn assert_mem_uninitialized_valid<T>();

/// Gets a reference to a static `Location` indicating where it was called.
///
/// 注意，与大多数内联函数不同，调用此函数是安全的；
/// it does not require an `unsafe` block.
/// 因此，实现不得要求用户遵守任何安全不变量。
/// any safety invariants.
///
/// Consider using [`core::panic::Location::caller`] instead.
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn caller_location() -> &'static crate::panic::Location<'static>;

/// Moves a value out of scope without running drop glue.
///
/// This exists solely for [`crate::mem::forget_unsized`]; normal `forget` uses
/// `ManuallyDrop` instead.
///
/// 与大多数内联函数不同，调用此函数是安全的；
/// it does not require an `unsafe` block.
/// 因此，实现不得要求用户遵守任何安全不变量。
/// 此内联函数没有稳定的对应实现。
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn forget<T: ?Sized>(_: T);

/// 将一种类型的数值位重新解释为另一种类型。
///
/// 两种类型必须具有相同的大小。如果无法保证这一点，编译将失败。
///
/// `transmute` is semantically equivalent to a bitwise move of one type
/// 将其从源值复制到
/// destination value, then forgets the original. Note that source and destination
/// are passed by-value, which means if `Src` or `Dst` contain padding, that padding
/// is *not* guaranteed to be preserved by `transmute`.
///
/// Both the argument and the result must be [valid](../../nomicon/what-unsafe-does.html) at
/// their given type. Violating this condition leads to [undefined behavior][ub]. The compiler
/// will generate code *assuming that you, the programmer, ensure that there will never be
/// undefined behavior*. It is therefore your responsibility to guarantee that every value
/// passed to `transmute` is valid at both types `Src` and `Dst`. Failing to uphold this condition
/// may lead to unexpected and unstable compilation results. This makes `transmute` **incredibly
/// unsafe**. `transmute` should be the absolute last resort.
///
/// Because `transmute` is a by-value operation, alignment of the *transmuted values
/// 正确对齐。
/// both `Src` and `Dst` are properly aligned. However, when transmuting values that *point
/// # 指针与整数之间的转换
/// 在指针和整数之间转换时需要特别小心，例如
///
/// The [nomicon](../../nomicon/transmutes.html) has additional documentation.
///
/// [ub]: ../../reference/behavior-considered-undefined.html
///
/// # Transmutation between pointers and integers
///
/// Special care has to be taken when transmuting between pointers and integers, e.g.
/// transmuting between `*const ()` and `usize`.
///
/// Transmuting *pointers to integers* in a `const` context is [undefined behavior][ub], unless
/// the pointer was originally created *from* an integer. (That includes this function
/// specifically, integer-to-pointer casts, and helpers like [`dangling`][crate::ptr::dangling],
/// but also semantically-equivalent conversions such as punning through `repr(C)` union
/// fields.) Any attempt to use the resulting value for integer operations will abort
/// const-evaluation. (And even outside `const`, such transmutation is touching on many
/// unspecified aspects of the Rust memory model and should be avoided. See below for
/// alternatives.)
///
/// Transmuting *integers to pointers* is a largely unspecified operation. It is likely *not*
/// equivalent to an `as` cast. Doing non-zero-sized memory accesses with a pointer constructed
/// 这种用法目前被视为未定义行为。
///
/// 当整数嵌套在数组、元组、结构体或枚举中时，同样适用此规则。
/// However, `MaybeUninit<usize>` is not considered an integer type for the purpose of this
/// section. Transmuting `*const ()` to `MaybeUninit<usize>` is fine---but then calling
/// `assume_init()` on that result is considered as completing the pointer-to-integer transmute
/// 因此会遇到上述讨论的问题。
///
/// In particular, doing a pointer-to-integer-to-pointer roundtrip via `transmute` is *not* a
/// 无损过程。如果您希望以某种方式通过整数完成指针的循环转换，使得
/// can get back the original pointer, you need to use `as` casts, or replace the integer type
/// by `MaybeUninit<$int>` (and never call `assume_init()`). If you are looking for a way to
/// store data of arbitrary type, also use `MaybeUninit<T>` (that will also handle uninitialized
/// memory due to padding). If you specifically need to store something that is "either an
/// integer or a pointer", use `*mut ()`: integers can be converted to pointers and back without
/// any loss (via `as` casts or via `transmute`).
///
/// # 将指针转换为函数指针。这在功能指针和数据指针大小不同的机器上*不*可移植。
///
/// There are a few things that `transmute` is really useful for.
///
/// # 替代方案
/// machines where function pointers and data pointers have different sizes.
///
/// ```
/// fn foo() -> i32 {
///     0
/// }
/// // Crucially, we `as`-cast to a raw pointer before `transmute`ing to a function pointer.
/// // This avoids an integer-to-pointer `transmute`, which can be problematic.
/// // Transmuting between raw pointers and function pointers (i.e., two pointer types) is fine.
/// let pointer = foo as fn() -> i32 as *const ();
/// let function = unsafe {
///     std::mem::transmute::<*const (), fn() -> i32>(pointer)
/// };
/// assert_eq!(function(), 0);
/// ```
///
/// Extending a lifetime, or shortening an invariant lifetime. This is
/// advanced, very unsafe Rust!
///
/// ```
/// struct R<'a>(&'a i32);
/// unsafe fn extend_lifetime<'b>(r: R<'b>) -> R<'static> {
///     unsafe { std::mem::transmute::<R<'b>, R<'static>>(r) }
/// }
///
/// unsafe fn shorten_invariant_lifetime<'b, 'c>(r: &'b mut R<'static>)
///                                              -> &'b mut R<'c> {
///     unsafe { std::mem::transmute::<&'b mut R<'static>, &'b mut R<'c>>(r) }
/// }
/// ```
///
/// # Alternatives
///
/// Don't despair: many uses of `transmute` can be achieved through other means.
/// Below are common applications of `transmute` which can be replaced with safer
/// constructs.
///
/// Turning raw bytes (`[u8; SZ]`) into `u32`, `f64`, etc.:
///
/// ```
/// # #![allow(unnecessary_transmutes)]
/// let raw_bytes = [0x78, 0x56, 0x34, 0x12];
///
/// let num = unsafe {
///     std::mem::transmute::<[u8; 4], u32>(raw_bytes)
/// };
///
/// // use `u32::from_ne_bytes` instead
/// let num = u32::from_ne_bytes(raw_bytes);
/// // or use `u32::from_le_bytes` or `u32::from_be_bytes` to specify the endianness
/// let num = u32::from_le_bytes(raw_bytes);
/// assert_eq!(num, 0x12345678);
/// let num = u32::from_be_bytes(raw_bytes);
/// assert_eq!(num, 0x78563412);
/// ```
///
/// Turning a pointer into a `usize`:
///
/// ```no_run
/// let ptr = &0;
/// let ptr_num_transmute = unsafe {
///     std::mem::transmute::<&i32, usize>(ptr)
/// };
///
/// // Use an `as` cast instead
/// let ptr_num_cast = ptr as *const i32 as usize;
/// ```
///
/// Note that using `transmute` to turn a pointer to a `usize` is (as noted above) [undefined
/// behavior][ub] in `const` contexts. Also outside of consts, this operation might not behave
/// as expected -- this is touching on many unspecified aspects of the Rust memory model.
/// Depending on what the code is doing, the following alternatives are preferable to
/// pointer-to-integer transmutation:
/// - If the code just wants to store data of arbitrary type in some buffer and needs to pick a
///   type for that buffer, it can use [`MaybeUninit`][crate::mem::MaybeUninit].
/// - If the code actually wants to work on the address the pointer points to, it can use `as`
///   casts or [`ptr.addr()`][pointer::addr].
///
/// Turning a `*mut T` into a `&mut T`:
///
/// ```
/// let ptr: *mut i32 = &mut 0;
/// let ref_transmuted = unsafe {
///     std::mem::transmute::<*mut i32, &mut i32>(ptr)
/// };
///
/// // Use a reborrow instead
/// let ref_casted = unsafe { &mut *ptr };
/// ```
///
/// Turning a `&mut T` into a `&mut U`:
///
/// ```
/// let ptr = &mut 0;
/// let val_transmuted = unsafe {
///     std::mem::transmute::<&mut i32, &mut u32>(ptr)
/// };
///
/// // Now, put together `as` and reborrowing - note the chaining of `as`
/// // `as` is not transitive
/// let val_casts = unsafe { &mut *(ptr as *mut i32 as *mut u32) };
/// ```
///
/// Turning a `&str` into a `&[u8]`:
///
/// ```
/// // this is not a good way to do this.
/// let slice = unsafe { std::mem::transmute::<&str, &[u8]>("Rust") };
/// assert_eq!(slice, &[82, 117, 115, 116]);
///
/// // You could use `str::as_bytes`
/// let slice = "Rust".as_bytes();
/// assert_eq!(slice, &[82, 117, 115, 116]);
///
/// // Or, just use a byte string, if you have control over the string
/// // literal
/// assert_eq!(b"Rust", &[82, 117, 115, 116]);
/// ```
///
/// Turning a `Vec<&T>` into a `Vec<Option<&T>>`.
///
/// 要转换容器内容内部类型，必须确保不
/// violate any of the container's invariants. For `Vec`, this means that both the size
/// *和对齐方式* 必须一致。其他容器可能依赖于
/// size of the type, alignment, or even the `TypeId`, in which case transmuting wouldn't
/// 进行转换。
///
/// ```
/// let store = [0, 1, 2, 3];
/// let v_orig = store.iter().collect::<Vec<&i32>>();
///
/// // clone the vector as we will reuse them later
/// let v_clone = v_orig.clone();
///
/// // Using transmute: this relies on the unspecified data layout of `Vec`, which is a
/// // bad idea and could cause Undefined Behavior.
/// // However, it is no-copy.
/// let v_transmuted = unsafe {
///     std::mem::transmute::<Vec<&i32>, Vec<Option<&i32>>>(v_clone)
/// };
///
/// let v_clone = v_orig.clone();
///
/// // This is the suggested, safe way.
/// // It may copy the entire vector into a new one though, but also may not.
/// let v_collected = v_clone.into_iter()
///                          .map(Some)
///                          .collect::<Vec<Option<&i32>>>();
///
/// let v_clone = v_orig.clone();
///
/// // This is the proper no-copy, unsafe way of "transmuting" a `Vec`, without relying on the
/// // data layout. Instead of literally calling `transmute`, we perform a pointer cast, but
/// // in terms of converting the original inner type (`&i32`) to the new one (`Option<&i32>`),
/// // this has all the same caveats. Besides the information provided above, also consult the
/// // [`from_raw_parts`] documentation.
/// let (ptr, len, capacity) = v_clone.into_raw_parts();
/// let v_from_raw = unsafe {
///     Vec::from_raw_parts(ptr.cast::<*mut Option<&i32>>(), len, capacity)
/// };
/// ```
///
/// [`from_raw_parts`]: ../../std/vec/struct.Vec.html#method.from_raw_parts
///
/// Implementing `split_at_mut`:
///
/// ```
/// use std::{slice, mem};
///
/// // There are multiple ways to do this, and there are multiple problems
/// // with the following (transmute) way.
/// fn split_at_mut_transmute<T>(slice: &mut [T], mid: usize)
///                              -> (&mut [T], &mut [T]) {
///     let len = slice.len();
///     assert!(mid <= len);
///     unsafe {
///         let slice2 = mem::transmute::<&mut [T], &mut [T]>(slice);
///         // first: transmute is not type safe; all it checks is that T and
///         // U are of the same size. Second, right here, you have two
///         // mutable references pointing to the same memory.
///         (&mut slice[0..mid], &mut slice2[mid..len])
///     }
/// }
///
/// // This gets rid of the type safety problems; `&mut *` will *only* give
/// // you a `&mut T` from a `&mut T` or `*mut T`.
/// fn split_at_mut_casts<T>(slice: &mut [T], mid: usize)
///                          -> (&mut [T], &mut [T]) {
///     let len = slice.len();
///     assert!(mid <= len);
///     unsafe {
///         let slice2 = &mut *(slice as *mut [T]);
///         // however, you still have two mutable references pointing to
///         // the same memory.
///         (&mut slice[0..mid], &mut slice2[mid..len])
///     }
/// }
///
/// // This is how the standard library does it. This is the best method, if
/// // you need to do something like this
/// fn split_at_stdlib<T>(to_split: &mut [T], mid: usize)
///                       -> (&mut [T], &mut [T]) {
///     let len = to_split.len();
///     assert!(mid <= len);
///     unsafe {
///         let ptr = to_split.as_mut_ptr();
///         let fst = slice::from_raw_parts_mut(ptr, mid);
///         let snd = slice::from_raw_parts_mut(ptr.add(mid), len - mid);
///         // The function now has three mutable references to overlapping memory:
///         // `to_split`, `fst`, and `snd`.
///         // `to_split` is never used after `let ptr = ...` so it can be treated as "dead".
///         // This leaves two "live" mutable slice references, `fst` and `snd`, with no overlap.
///         (fst, snd)
///     }
/// }
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_allowed_through_unstable_modules(
    message = "import this function via the `mem` module instead",
    module = "mem"
)]
#[rustc_const_stable(feature = "const_transmute", since = "1.56.0")]
#[rustc_diagnostic_item = "transmute"]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const unsafe fn transmute<Src, Dst>(src: Src) -> Dst;

/// Like [`transmute`], but even less checked at compile-time: rather than
/// giving an error for `size_of::<Src>() != size_of::<Dst>()`, it's
/// **未定义行为**。
///
/// Prefer normal `transmute` where possible, for the extra checking, since
/// 如果两者都能编译通过，它们在运行时做的事情完全相同。
///
/// 预计这不会直接暴露给用户，而是
/// 最终可能通过更受限的 API 暴露出来。
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const unsafe fn transmute_unchecked<Src, Dst>(src: Src) -> Dst;

/// Returns `true` if the actual type given as `T` requires drop
/// glue; returns `false` if the actual type provided for `T`
/// implements `Copy`.
///
/// 如果实际类型既不需要 drop glue 也不实现
/// `Copy`, then the return value of this function is unspecified.
///
/// 注意，与大多数内联函数不同，这只能在编译时调用，
/// as backends do not have an implementation for it. The only caller (its
/// stable counterpart) wraps this intrinsic call in a `const` block so that
/// backends only see an evaluated constant.
///
/// The stabilized version of this intrinsic is [`mem::needs_drop`](crate::mem::needs_drop).
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
#[rustc_comptime]
pub fn needs_drop<T: ?Sized>() -> bool;

/// 计算指针偏移量。
///
/// 作为内联函数实现，以避免转换为整数，因为转换会丢失别名信息。
/// integer, since the conversion would throw away aliasing information.
///
/// This can only be used with `Ptr` as a raw pointer type (`*mut` or `*const`)
/// to a `Sized` pointee and with `Delta` as `usize` or `isize`.  Any other
/// # 安全性
///
/// # 如果计算出的偏移量非零，则起始指针和结果指针必须
///
/// 要么在边界内，要么位于分配结束处。如果任一指针超出边界或发生算术溢出，则此操作属于未定义行为。
/// either in bounds or at the end of an allocation. If either pointer is out
/// of bounds or arithmetic overflow occurs then this operation is undefined behavior.
///
/// The stabilized version of this intrinsic is [`pointer::offset`].
#[must_use = "returns a new pointer rather than modifying its argument"]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const unsafe fn offset<Ptr: bounds::BuiltinDeref, Delta>(dst: Ptr, offset: Delta) -> Ptr;

/// 计算指针的偏移量，可能进行循环。
///
/// 作为内建函数实现，以避免与整数转换相关的操作。
/// 由于整数转换会阻碍某些优化，因此采用这种方式。
///
/// # 安全性
///
/// Unlike the `offset` intrinsic, this intrinsic does not restrict the
/// 生成的指针指向已分配对象的内部或末尾，并且使用二进制补数运算进行循环。生成的值不一定可用于实际访问内存。
/// object, and it wraps with two's complement arithmetic. The resulting
/// value is not necessarily valid to be used to actually access memory.
///
/// The stabilized version of this intrinsic is [`pointer::wrapping_offset`].
#[must_use = "returns a new pointer rather than modifying its argument"]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const unsafe fn arith_offset<T>(dst: *const T, offset: isize) -> *const T;

/// Projects to the `index`-th element of `slice_ptr`, as the same kind of pointer
/// as the slice was provided -- so `&mut [T] → &mut T`, `&[T] → &T`,
/// `*mut [T] → *mut T`, or `*const [T] → *const T` -- without a bounds check.
///
/// This is exposed via `<usize as SliceIndex>::get(_unchecked)(_mut)`,
/// and isn't intended to be used elsewhere.
///
/// Expands in MIR to `{&, &mut, &raw const, &raw mut} (*slice_ptr)[index]`,
/// # 安全性
///
/// # Safety
///
/// - `index < PtrMetadata(slice_ptr)`, so the indexing is in-bounds for the slice
/// 对于引用总是如此，但对于指针则需要手动维护。
/// 根据掩码屏蔽指针中的部分位。
#[rustc_nounwind]
#[rustc_intrinsic]
pub const unsafe fn slice_get_unchecked<
    ItemPtr: bounds::ChangePointee<[T], Pointee = T, Output = SlicePtr>,
    SlicePtr,
    T,
>(
    slice_ptr: SlicePtr,
    index: usize,
) -> ItemPtr;

/// 与大多数内建函数不同，调用此函数是安全的；
///
/// Note that, unlike most intrinsics, this is safe to call;
/// it does not require an `unsafe` block.
/// Therefore, implementations must not require the user to uphold
/// any safety invariants.
///
/// Consider using [`pointer::mask`] instead.
#[rustc_nounwind]
#[rustc_intrinsic]
pub fn ptr_mask<T>(ptr: *const T, mask: usize) -> *const T;

/// Equivalent to the appropriate `llvm.memcpy.p0i8.0i8.*` intrinsic, with
/// a size of `count` * `size_of::<T>()` and an alignment of `align_of::<T>()`.
///
/// This intrinsic does not have a public counterpart.
#[rustc_intrinsic]
#[rustc_nounwind]
pub unsafe fn volatile_copy_nonoverlapping_memory<T>(dst: *mut T, src: *const T, count: usize);
/// Equivalent to the appropriate `llvm.memmove.p0i8.0i8.*` intrinsic, with
/// a size of `count * size_of::<T>()` and an alignment of `align_of::<T>()`.
///
/// The volatile parameter is set to `true`, so it will not be optimized out
/// 除非大小为零。
///
/// 此内建函数没有公共对应版本。
#[rustc_intrinsic]
#[rustc_nounwind]
pub unsafe fn volatile_copy_memory<T>(dst: *mut T, src: *const T, count: usize);
/// Equivalent to the appropriate `llvm.memset.p0i8.*` intrinsic, with a
/// size of `count * size_of::<T>()` and an alignment of `align_of::<T>()`.
///
/// 此内建函数没有公共对应版本。
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn volatile_set_memory<T>(dst: *mut T, val: u8, count: usize);

/// Performs a volatile load from the `src` pointer.
///
/// The stabilized version of this intrinsic is [`core::ptr::read_volatile`].
///
/// # 安全性
///
/// See [`crate::ptr::read_volatile`] for safety conditions.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn volatile_load<T>(src: *const T) -> T;
/// Performs a volatile store to the `dst` pointer.
///
/// The stabilized version of this intrinsic is [`core::ptr::write_volatile`].
///
/// # 安全性
///
/// See [`crate::ptr::write_volatile`] for safety conditions.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn volatile_store<T>(dst: *mut T, val: T);

/// Performs a volatile load from the `src` pointer
/// 不需要指针对齐。
///
/// 此内建函数没有稳定的对应实现。
///
/// # 安全性
/// See [`crate::ptr::read_volatile`] for safety conditions,
/// but note that `src` does not need to be aligned.
#[rustc_intrinsic]
#[rustc_nounwind]
#[rustc_diagnostic_item = "intrinsics_unaligned_volatile_load"]
pub unsafe fn unaligned_volatile_load<T>(src: *const T) -> T;
/// Performs a volatile store to the `dst` pointer.
/// 不需要指针对齐。
///
/// 此内建函数没有稳定的对应实现。
///
/// # 安全性
/// See [`crate::ptr::write_volatile`] for safety conditions,
/// but note that `dst` does not need to be aligned.
#[rustc_intrinsic]
#[rustc_nounwind]
#[rustc_diagnostic_item = "intrinsics_unaligned_volatile_store"]
pub unsafe fn unaligned_volatile_store<T>(dst: *mut T, val: T);

intrinsic_dispatch_on_type! {
    /// 返回浮点数值的平方根。
    ///
    /// 此内建函数的稳定版本可通过 float 原语的
    /// `sqrt` method. For example, [`f32::sqrt`](../../std/primitive.f32.html#method.sqrt).
    #[rustc_nounwind]
    #[rustc_intrinsic]
    pub fn sqrt<T: bounds::FloatPrimitive>(x: T) -> T;

    f16 => { libm::sqrtf16(x) }
    f32 => { libm::sqrtf(x) }
    f64 => { libm::sqrt(x) }
    f128 => { libm::sqrtf128(x) }
}

intrinsic_dispatch_on_type! {
    /// 将浮点数值提升为整数幂。
    ///
    /// 此内建函数的稳定版本可通过 float 原语的
    /// `powi` method. For example, [`f32::powi`](../../std/primitive.f32.html#method.powi).
    #[rustc_nounwind]
    #[inline]
    #[rustc_intrinsic]
    pub fn powi<T: bounds::FloatPrimitive>(a: T, x: i32) -> T;

    f16 => { powi(a as f32, x) as f16 }
    f32 => { libm::__powisf2(a, x) }
    f64 => { libm::__powidf2(a, x) }
    f128 => { libm::__powitf2(a, x) }
}

intrinsic_dispatch_on_type! {
    /// 返回浮点数值的正弦值。
    ///
    /// 此内建函数的稳定版本可通过 float 原语的
    /// `sin` method. For example, [`f32::sin`](../../std/primitive.f32.html#method.sin).
    #[rustc_nounwind]
    #[inline]
    #[rustc_intrinsic]
    pub fn sin<T: bounds::FloatPrimitive>(x: T) -> T;

    f16 => { sin(x as f32) as f16 }
    f32 => {
        cfg_select! {
            all(target_env = "msvc", target_arch = "x86") => sin(x as f64) as f32,
            _ => libm::likely_available::sinf(x),
        }
    }
    f64 => { libm::likely_available::sin(x) }
    f128 => { libm::maybe_available::sinf128(x) }
}

intrinsic_dispatch_on_type! {
    /// 返回浮点数值的余弦值。
    ///
    /// 此内建函数的稳定版本可通过 float 原语的
    /// `cos` method. For example, [`f32::cos`](../../std/primitive.f32.html#method.cos).
    #[rustc_nounwind]
    #[inline]
    #[rustc_intrinsic]
    pub fn cos<T: bounds::FloatPrimitive>(x: T) -> T;

    f16 => { cos(x as f32) as f16 }
    f32 => {
        cfg_select! {
            all(target_env = "msvc", target_arch = "x86") => cos(x as f64) as f32,
            _ => libm::likely_available::cosf(x),
        }
    }
    f64 => { libm::likely_available::cos(x) }
    f128 => { libm::maybe_available::cosf128(x) }
}

intrinsic_dispatch_on_type! {
    /// 将浮点数值提升为相同类型的幂。
    ///
    /// 此内建函数的稳定版本可通过 float 原语的
    /// `powf` method. For example, [`f32::powf`](../../std/primitive.f32.html#method.powf).
    #[rustc_nounwind]
    #[inline]
    #[rustc_intrinsic]
    pub fn powf<T: bounds::FloatPrimitive>(a: T, x: T) -> T;

    f16 => { powf(a as f32, x as f32) as f16 }
    f32 => {
        cfg_select! {
            all(target_env = "msvc", target_arch = "x86") => powf(a as f64, x as f64) as f32,
            _ => libm::likely_available::powf(a, x),
        }
    }
    f64 => { libm::likely_available::pow(a, x) }
    f128 => { libm::maybe_available::powf128(a, x) }
}

intrinsic_dispatch_on_type! {
    /// 返回浮点数值的指数。
    ///
    /// 此内建函数的稳定版本可通过 float 原语的
    /// `exp` method. For example, [`f32::exp`](../../std/primitive.f32.html#method.exp).
    #[rustc_nounwind]
    #[inline]
    #[rustc_intrinsic]
    pub fn exp<T: bounds::FloatPrimitive>(x: T) -> T;

    f16 => { exp(x as f32) as f16 }
    f32 => {
        cfg_select! {
            all(target_env = "msvc", target_arch = "x86") => exp(x as f64) as f32,
            _ => libm::likely_available::expf(x),
        }
    }
    f64 => { libm::likely_available::exp(x) }
    f128 => { libm::maybe_available::expf128(x) }
}

intrinsic_dispatch_on_type! {
    /// 返回 2 的浮点数值幂。
    ///
    /// 此内建函数的稳定版本可通过 float 原语的
    /// `exp2` method. For example, [`f32::exp2`](../../std/primitive.f32.html#method.exp2).
    #[rustc_nounwind]
    #[inline]
    #[rustc_intrinsic]
    pub fn exp2<T: bounds::FloatPrimitive>(x: T) -> T;

    f16 => { exp2(x as f32) as f16 }
    f32 => {
        cfg_select! {
            all(target_env = "msvc", target_arch = "x86") => exp2(x as f64) as f32,
            _ => libm::likely_available::exp2f(x),
        }
    }
    f64 => { libm::likely_available::exp2(x) }
    f128 => { libm::maybe_available::exp2f128(x) }
}

intrinsic_dispatch_on_type! {
    /// 返回浮点数值的自然对数。
    ///
    /// 此内建函数的稳定版本可通过 float 原语的
    /// `ln` method. For example, [`f32::ln`](../../std/primitive.f32.html#method.ln).
    #[rustc_nounwind]
    #[inline]
    #[rustc_intrinsic]
    pub fn log<T: bounds::FloatPrimitive>(x: T) -> T;

    f16 => { log(x as f32) as f16 }
    f32 => {
        cfg_select! {
            all(target_env = "msvc", target_arch = "x86") => log(x as f64) as f32,
            _ => libm::likely_available::logf(x),
        }
    }
    f64 => { libm::likely_available::log(x) }
    f128 => { libm::maybe_available::logf128(x) }
}

intrinsic_dispatch_on_type! {
    /// 返回浮点数值的以 10 为底的对数。
    ///
    /// 此内建函数的稳定版本可通过 float 原语的
    /// `log10` method. For example, [`f32::log10`](../../std/primitive.f32.html#method.log10).
    #[rustc_nounwind]
    #[inline]
    #[rustc_intrinsic]
    pub fn log10<T: bounds::FloatPrimitive>(x: T) -> T;

    f16 => { log10(x as f32) as f16 }
    f32 => {
        cfg_select! {
            all(target_env = "msvc", target_arch = "x86") => log10(x as f64) as f32,
            _ => libm::likely_available::log10f(x),
        }
    }
    f64 => { libm::likely_available::log10(x) }
    f128 => { libm::maybe_available::log10f128(x) }
}

intrinsic_dispatch_on_type! {
    /// 返回浮点数值的以 2 为底的对数。
    ///
    /// 此内建函数的稳定版本可通过 float primitives 使用
    /// `log2` method. For example, [`f32::log2`](../../std/primitive.f32.html#method.log2).
    #[rustc_nounwind]
    #[inline]
    #[rustc_intrinsic]
    pub fn log2<T: bounds::FloatPrimitive>(x: T) -> T;

    f16 => { log2(x as f32) as f16 }
    f32 => {
        cfg_select! {
            all(target_env = "msvc", target_arch = "x86") => log2(x as f64) as f32,
            _ => libm::likely_available::log2f(x),
        }
    }
    f64 => { libm::likely_available::log2(x) }
    f128 => { libm::maybe_available::log2f128(x) }
}

intrinsic_dispatch_on_type! {
    /// Returns `a * b + c` without rounding the intermediate result.
    ///
    /// 此内建函数的稳定版本可通过 float primitives 使用
    /// `mul_add` method. For example,
    /// [`f32::mul_add`](../../std/primitive.f32.html#method.mul_add).
    #[rustc_nounwind]
    #[inline]
    #[rustc_intrinsic_const_stable_indirect]
    #[rustc_intrinsic]
    // The fallback bodies call into `libm`, which is not available at compile time. This is fine
    // because const-eval implements this intrinsic itself and never runs the fallback body.
    #[rustc_do_not_const_check]
    pub const fn fma<T: bounds::FloatPrimitive>(a: T, b: T, c: T) -> T;

    f16 => { libm::fmaf16(a, b, c) }
    f32 => { libm::fmaf(a, b, c) }
    f64 => { libm::fma(a, b, c) }
    f128 => { libm::fmaf128(a, b, c) }
}

intrinsic_dispatch_on_type! {
    /// Calculates `x * 2.0^exp` efficiently.
    ///
    /// 此内建函数的公共版本可通过 float primitives 使用
    /// `scalbn` method. For example, [`f32::scalbn`](../../std/primitive.f32.html#method.scalbn).
    #[rustc_nounwind]
    #[inline]
    #[rustc_intrinsic]
    // The fallback bodies call into `libm`, which is not available at compile time. This is fine
    // because const-eval implements this intrinsic itself and never runs the fallback body.
    #[rustc_do_not_const_check]
    pub const fn scalbn<T: bounds::FloatPrimitive>(x: T, exp: i32) -> T;

    f16 => { libm::scalbnf16(x, exp) }
    f32 => { libm::scalbnf(x, exp) }
    f64 => { libm::scalbn(x, exp) }
    f128 => { libm::scalbnf128(x, exp) }
}

intrinsic_dispatch_on_type! {
    /// 提取输入值的不偏倚指数，忽略符号
    ///
    /// When the input is an infinity, the result is [`i32::MAX`].
    /// 此内建函数不得在零或 NaN 上调用
    ///
    /// 此内建函数的公共版本可通过 float primitives 使用
    /// `ilogb` method. For example, [`f32::ilogb`](../../std/primitive.f32.html#method.ilogb).
    ///
    /// # 安全性
    ///
    /// 当输入为零或 NaN 时，行为未定义
    #[rustc_nounwind]
    #[inline]
    #[rustc_intrinsic]
    // The fallback bodies call into `libm`, which is not available at compile time. This is fine
    // because const-eval implements this intrinsic itself and never runs the fallback body.
    // libm requirements ensure the correct result for infinities.
    // libm implementations differ on zero and NaN, but the intrinsic may not be called for such
    // inputs anyway.
    #[rustc_do_not_const_check]
    pub const unsafe fn ilogb<T: bounds::FloatPrimitive>(x: T) -> i32;

    f16 => { libm::ilogbf16(x) }
    f32 => { libm::ilogbf(x) }
    f64 => { libm::ilogb(x) }
    f128 => { libm::ilogbf128(x) }
}

/// Returns `a * b + c`, non-deterministically executing either a fused multiply-add or two
/// 操作，其中中间结果进行四舍五入
///
/// 如果代码生成器确定目标
/// 指令集支持融合操作，且融合操作比等效的单独 mul 和 add 指令更高效，则操作为融合操作
/// 操作。是否选择融合操作未指定，可能取决于优化级别和上下文
/// 例如。
/// 此内建函数的稳定版本可通过 float primitives 使用
/// example.
///
/// 返回小于或等于浮点值的最大整数
/// `mul_add_relaxed` method. For example,
/// [`f32::mul_add_relaxed`](../../std/primitive.f32.html#method.mul_add_relaxed).
#[inline]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_intrinsic]
#[rustc_nounwind]
#[rustc_do_not_const_check]
pub const fn fmuladd<T: bounds::FloatPrimitive>(a: T, b: T, c: T) -> T {
    a * b + c
}

intrinsic_dispatch_on_type! {
    /// Returns the largest integer less than or equal to a floating-point value.
    ///
    /// 返回大于或等于浮点值的最小整数
    /// `floor` method. For example, [`f32::floor`](../../std/primitive.f32.html#method.floor).
    #[rustc_nounwind]
    #[inline]
    #[rustc_intrinsic_const_stable_indirect]
    #[rustc_intrinsic]
    // The fallback bodies call into `libm`, which is not available at compile time. This is fine
    // because const-eval implements this intrinsic itself and never runs the fallback body.
    #[rustc_do_not_const_check]
    pub const fn floor<T: bounds::FloatPrimitive>(x: T) -> T;

    f16 => { libm::floorf16(x) }
    f32 => { libm::floorf(x) }
    f64 => { libm::floor(x) }
    f128 => { libm::floorf128(x) }
}

intrinsic_dispatch_on_type! {
    /// 返回大于或等于浮点值的最小整数
    ///
    /// 此内建函数的稳定版本可通过 float primitives 使用
    /// `ceil` method. For example, [`f32::ceil`](../../std/primitive.f32.html#method.ceil).
    #[rustc_nounwind]
    #[inline]
    #[rustc_intrinsic_const_stable_indirect]
    #[rustc_intrinsic]
    // The fallback bodies call into `libm`, which is not available at compile time. This is fine
    // because const-eval implements this intrinsic itself and never runs the fallback body.
    #[rustc_do_not_const_check]
    pub const fn ceil<T: bounds::FloatPrimitive>(x: T) -> T;

    f16 => { libm::ceilf16(x) }
    f32 => { libm::ceilf(x) }
    f64 => { libm::ceil(x) }
    f128 => { libm::ceilf128(x) }
}

intrinsic_dispatch_on_type! {
    /// 返回浮点值的整数部分
    ///
    /// 此内建函数的稳定版本可通过 float primitives 使用
    /// `trunc` method. For example, [`f32::trunc`](../../std/primitive.f32.html#method.trunc).
    #[rustc_nounwind]
    #[inline]
    #[rustc_intrinsic_const_stable_indirect]
    #[rustc_intrinsic]
    // The fallback bodies call into `libm`, which is not available at compile time. This is fine
    // because const-eval implements this intrinsic itself and never runs the fallback body.
    #[rustc_do_not_const_check]
    pub const fn trunc<T: bounds::FloatPrimitive>(x: T) -> T;

    f16 => { libm::truncf16(x) }
    f32 => { libm::truncf(x) }
    f64 => { libm::trunc(x) }
    f128 => { libm::truncf128(x) }
}

intrinsic_dispatch_on_type! {
    /// 返回最接近浮点值的整数。半途情况按具有偶数最低有效位的数字进行四舍五入
    /// 此内建函数的稳定版本可通过 float primitives 使用
    ///
    /// The stabilized versions of this intrinsic are available on the float primitives via the
    /// `round_ties_even` method. For example,
    /// [`f32::round_ties_even`](../../std/primitive.f32.html#method.round_ties_even).
    #[rustc_nounwind]
    #[inline]
    #[rustc_intrinsic_const_stable_indirect]
    #[rustc_intrinsic]
    // The fallback bodies call into `libm`, which is not available at compile time. This is fine
    // because const-eval implements this intrinsic itself and never runs the fallback body.
    #[rustc_do_not_const_check]
    pub const fn round_ties_even<T: bounds::FloatPrimitive>(x: T) -> T;

    f16 => { libm::roundevenf16(x) }
    f32 => { libm::roundevenf(x) }
    f64 => { libm::roundeven(x) }
    f128 => { libm::roundevenf128(x) }
}

intrinsic_dispatch_on_type! {
    /// 返回最接近浮点数值的整数。将介于中间的值四舍五入到远离该值的一侧。
    /// 零。
    ///
    /// 此内建函数的稳定版本可通过 float 原语获得。
    /// `round` method. For example, [`f32::round`](../../std/primitive.f32.html#method.round).
    #[rustc_nounwind]
    #[inline]
    #[rustc_intrinsic_const_stable_indirect]
    #[rustc_intrinsic]
    // The fallback bodies call into `libm`, which is not available at compile time. This is fine
    // because const-eval implements this intrinsic itself and never runs the fallback body.
    #[rustc_do_not_const_check]
    pub const fn round<T: bounds::FloatPrimitive>(x: T) -> T;

    f16 => { libm::roundf16(x) }
    f32 => { libm::roundf(x) }
    f64 => { libm::round(x) }
    f128 => { libm::roundf128(x) }
}

/// 允许基于代数规则进行优化的浮点加法。
/// 要求操作输入和输出为有限值，否则会导致未定义行为（UB）。
///
/// 此内建函数没有稳定的对应版本。
#[rustc_intrinsic]
#[rustc_nounwind]
pub unsafe fn fadd_fast<T: bounds::FloatPrimitive>(a: T, b: T) -> T;

/// 允许基于代数规则进行优化的浮点减法。
/// 要求操作输入和输出为有限值，否则会导致未定义行为（UB）。
///
/// 此内建函数没有稳定的对应版本。
#[rustc_intrinsic]
#[rustc_nounwind]
pub unsafe fn fsub_fast<T: bounds::FloatPrimitive>(a: T, b: T) -> T;

/// 允许基于代数规则进行优化的浮点乘法。
/// 要求操作输入和输出为有限值，否则会导致未定义行为（UB）。
///
/// 此内建函数没有稳定的对应版本。
#[rustc_intrinsic]
#[rustc_nounwind]
pub unsafe fn fmul_fast<T: bounds::FloatPrimitive>(a: T, b: T) -> T;

/// 允许基于代数规则进行优化的浮点除法。
/// 要求操作输入和输出为有限值，否则会导致未定义行为（UB）。
///
/// 此内建函数没有稳定的对应版本。
#[rustc_intrinsic]
#[rustc_nounwind]
pub unsafe fn fdiv_fast<T: bounds::FloatPrimitive>(a: T, b: T) -> T;

/// 允许基于代数规则进行优化的浮点余数计算。
/// 要求操作输入和输出为有限值，否则会导致未定义行为（UB）。
///
/// 此内建函数没有稳定的对应版本。
#[rustc_intrinsic]
#[rustc_nounwind]
pub unsafe fn frem_fast<T: bounds::FloatPrimitive>(a: T, b: T) -> T;

/// 通过 LLVM 的 fptoui/fptosi 进行转换，对于超出范围的值可能返回 undef。
/// (<https://github.com/rust-lang/rust/issues/10184>)
///
/// Stabilized as [`f32::to_int_unchecked`] and [`f64::to_int_unchecked`].
#[rustc_intrinsic]
#[rustc_nounwind]
pub unsafe fn float_to_int_unchecked<Float: bounds::FloatPrimitive, Int: Copy>(value: Float)
-> Int;

/// 允许基于代数规则进行优化的浮点加法。
///
/// Stabilized as [`f16::algebraic_add`], [`f32::algebraic_add`], [`f64::algebraic_add`] and [`f128::algebraic_add`].
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn fadd_algebraic<T: bounds::FloatPrimitive>(a: T, b: T) -> T;

/// 允许基于代数规则进行优化的浮点减法。
///
/// Stabilized as [`f16::algebraic_sub`], [`f32::algebraic_sub`], [`f64::algebraic_sub`] and [`f128::algebraic_sub`].
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn fsub_algebraic<T: bounds::FloatPrimitive>(a: T, b: T) -> T;

/// 允许基于代数规则进行优化的浮点乘法。
///
/// Stabilized as [`f16::algebraic_mul`], [`f32::algebraic_mul`], [`f64::algebraic_mul`] and [`f128::algebraic_mul`].
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn fmul_algebraic<T: bounds::FloatPrimitive>(a: T, b: T) -> T;

/// 允许基于代数规则进行优化的浮点除法。
///
/// Stabilized as [`f16::algebraic_div`], [`f32::algebraic_div`], [`f64::algebraic_div`] and [`f128::algebraic_div`].
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn fdiv_algebraic<T: bounds::FloatPrimitive>(a: T, b: T) -> T;

/// 允许基于代数规则进行优化的浮点余数计算。
///
/// Stabilized as [`f16::algebraic_rem`], [`f32::algebraic_rem`], [`f64::algebraic_rem`] and [`f128::algebraic_rem`].
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn frem_algebraic<T: bounds::FloatPrimitive>(a: T, b: T) -> T;

/// Integer `min`imum, signed or unsigned depending on `T`.
///
/// Allowed only on `uN`, `iN`, `usize`, and `isize`.
/// (Not on `bool` nor on `char`.)
///
/// Stabilized as [`u16::min`] and [`i64::min`] and similar.
#[rustc_const_unstable(feature = "const_cmp", issue = "143800")]
#[rustc_nounwind]
#[rustc_intrinsic]
#[miri::intrinsic_fallback_is_spec]
pub const fn integer_min<T: [const] bounds::IntegerPrimitive>(a: T, b: T) -> T {
    if a < b { a } else { b }
}

/// Integer `max`imum, signed or unsigned depending on `T`.
///
/// Allowed only on `uN`, `iN`, `usize`, and `isize`.
/// (Not on `bool` nor on `char`.)
///
/// Stabilized as [`u16::max`] and [`i64::max`] and similar.
#[rustc_const_unstable(feature = "const_cmp", issue = "143800")]
#[rustc_nounwind]
#[rustc_intrinsic]
#[miri::intrinsic_fallback_is_spec]
pub const fn integer_max<T: [const] bounds::IntegerPrimitive>(a: T, b: T) -> T {
    if a < b { b } else { a }
}

/// Returns the number of bits set in an integer type `T`
///
/// 注意，与大多数内联函数不同，调用此函数是安全的；
/// it does not require an `unsafe` block.
/// 因此，实现代码不得要求用户遵守
/// 任何安全不变量。
///
/// The stabilized versions of this intrinsic are available on the integer
/// primitives via the `count_ones` method. For example,
/// [`u32::count_ones`]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn ctpop<T: Copy>(x: T) -> u32;

/// Returns the number of leading unset bits (zeroes) in an integer type `T`.
///
/// 注意，与大多数内联函数不同，调用此函数是安全的；
/// it does not require an `unsafe` block.
/// 因此，实现代码不得要求用户遵守
/// 任何安全不变量。
///
/// The stabilized versions of this intrinsic are available on the integer
/// primitives via the `leading_zeros` method. For example,
/// [`u32::leading_zeros`]
///
/// # 示例
///
/// ```
/// #![feature(core_intrinsics)]
/// # #![allow(internal_features)]
///
/// use std::intrinsics::ctlz;
///
/// let x = 0b0001_1100_u8;
/// let num_leading = ctlz(x);
/// assert_eq!(num_leading, 3);
/// ```
///
/// An `x` with value `0` will return the bit width of `T`.
///
/// ```
/// #![feature(core_intrinsics)]
/// # #![allow(internal_features)]
///
/// use std::intrinsics::ctlz;
///
/// let x = 0u16;
/// let num_leading = ctlz(x);
/// assert_eq!(num_leading, 16);
/// ```
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn ctlz<T: Copy>(x: T) -> u32;

/// Like `ctlz`, but extra-unsafe as it returns `undef` when
/// given an `x` with value `0`.
///
/// 此内联函数没有稳定的对应版本。
///
/// # 示例
///
/// ```
/// #![feature(core_intrinsics)]
/// # #![allow(internal_features)]
///
/// use std::intrinsics::ctlz_nonzero;
///
/// let x = 0b0001_1100_u8;
/// let num_leading = unsafe { ctlz_nonzero(x) };
/// assert_eq!(num_leading, 3);
/// ```
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const unsafe fn ctlz_nonzero<T: Copy>(x: T) -> u32;

/// Returns the number of trailing unset bits (zeroes) in an integer type `T`.
///
/// 注意，与大多数内联函数不同，调用此函数是安全的；
/// it does not require an `unsafe` block.
/// 因此，实现代码不得要求用户遵守
/// 任何安全不变量。
///
/// The stabilized versions of this intrinsic are available on the integer
/// primitives via the `trailing_zeros` method. For example,
/// [`u32::trailing_zeros`]
///
/// # 示例
///
/// ```
/// #![feature(core_intrinsics)]
/// # #![allow(internal_features)]
///
/// use std::intrinsics::cttz;
///
/// let x = 0b0011_1000_u8;
/// let num_trailing = cttz(x);
/// assert_eq!(num_trailing, 3);
/// ```
///
/// An `x` with value `0` will return the bit width of `T`:
///
/// ```
/// #![feature(core_intrinsics)]
/// # #![allow(internal_features)]
///
/// use std::intrinsics::cttz;
///
/// let x = 0u16;
/// let num_trailing = cttz(x);
/// assert_eq!(num_trailing, 16);
/// ```
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn cttz<T: Copy>(x: T) -> u32;

/// Like `cttz`, but extra-unsafe as it returns `undef` when
/// given an `x` with value `0`.
///
/// 此内联函数没有稳定的对应版本。
///
/// # 示例
///
/// ```
/// #![feature(core_intrinsics)]
/// # #![allow(internal_features)]
///
/// use std::intrinsics::cttz_nonzero;
///
/// let x = 0b0011_1000_u8;
/// let num_trailing = unsafe { cttz_nonzero(x) };
/// assert_eq!(num_trailing, 3);
/// ```
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const unsafe fn cttz_nonzero<T: Copy>(x: T) -> u32;

/// Reverses the bytes in an integer type `T`.
///
/// 注意，与大多数内联函数不同，调用此函数是安全的；
/// it does not require an `unsafe` block.
/// 因此，实现代码不得要求用户遵守
/// 任何安全不变量。
///
/// The stabilized versions of this intrinsic are available on the integer
/// primitives via the `swap_bytes` method. For example,
/// [`u32::swap_bytes`]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn bswap<T: Copy>(x: T) -> T;

/// Reverses the bits in an integer type `T`.
///
/// 注意，与大多数内联函数不同，调用此函数是安全的；
/// it does not require an `unsafe` block.
/// 因此，实现不得要求用户遵守
/// 任何安全不变量。
///
/// The stabilized versions of this intrinsic are available on the integer
/// primitives via the `reverse_bits` method. For example,
/// [`u32::reverse_bits`]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn bitreverse<T: Copy>(x: T) -> T;

/// 是否对两个参数进行三向比较，
/// 这些参数必须是字符或整数（有符号或无符号）类型。
///
/// This was originally added because it greatly simplified the MIR in `cmp`
/// 实现中的 MIR，随后 LLVM 20 也为其添加了后端内建函数。
///
/// The stabilized version of this intrinsic is [`Ord::cmp`].
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn three_way_compare<T: Copy>(lhs: T, rhss: T) -> crate::cmp::Ordering;

/// 合并两个没有共同位的值。
///
/// This allows the backend to implement it as `a + b` *or* `a | b`,
/// 具体取决于在特定目标上哪种实现更简便。
///
/// # 安全性
///
/// Requires that `(a & b) == 0`, or equivalently that `(a | b) == (a + b)`.
///
/// 否则即为立即 UB。
#[rustc_const_unstable(feature = "disjoint_bitor", issue = "135758")]
#[rustc_nounwind]
#[rustc_intrinsic]
#[track_caller]
#[miri::intrinsic_fallback_is_spec] // the fallbacks all `assume` to tell Miri
pub const unsafe fn disjoint_bitor<T: [const] fallback::DisjointBitOr>(a: T, b: T) -> T {
    // SAFETY: same preconditions as this function.
    unsafe { fallback::DisjointBitOr::disjoint_bitor(a, b) }
}

/// 执行经过检查的整数加法。
///
/// 请注意，与大多数内建函数不同，调用此函数是安全的；
/// it does not require an `unsafe` block.
/// 因此，实现不得要求用户遵守
/// 任何安全不变量。
///
/// 此内建函数的稳定版本可通过整数
/// primitives via the `overflowing_add` method. For example,
/// [`u32::overflowing_add`]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn add_with_overflow<T: Copy>(x: T, y: T) -> (T, bool);

/// 执行经过检查的整数减法
///
/// 请注意，与大多数内建函数不同，调用此函数是安全的；
/// it does not require an `unsafe` block.
/// 因此，实现不得要求用户遵守
/// 任何安全不变量。
///
/// 此内建函数的稳定版本可通过整数
/// primitives via the `overflowing_sub` method. For example,
/// [`u32::overflowing_sub`]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn sub_with_overflow<T: Copy>(x: T, y: T) -> (T, bool);

/// 执行经过检查的整数乘法
///
/// 请注意，与大多数内建函数不同，调用此函数是安全的；
/// it does not require an `unsafe` block.
/// 因此，实现不得要求用户遵守
/// 任何安全不变量。
///
/// 此内建函数的稳定版本可通过整数
/// primitives via the `overflowing_mul` method. For example,
/// [`u32::overflowing_mul`]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn mul_with_overflow<T: Copy>(x: T, y: T) -> (T, bool);

/// 执行带进位的全位乘法和加法：
/// `multiplier * multiplicand + addend + carry`.
///
/// This is possible without any overflow.  For `uN`:
/// MAX * MAX + MAX + MAX
/// => (2ⁿ-1) × (2ⁿ-1) + (2ⁿ-1) + (2ⁿ-1)
/// => (2²ⁿ - 2ⁿ⁺¹ + 1) + (2ⁿ⁺¹ - 2)
/// => 2²ⁿ - 1
///
/// For `iN`, the upper bound is MIN * MIN + MAX + MAX => 2²ⁿ⁻² + 2ⁿ - 2,
/// 下界为 MAX * MIN + MIN + MIN => -2²ⁿ⁻² - 2ⁿ + 2ⁿ⁺¹。
///
/// 目前仅支持无符号整数，不支持有符号整数。
/// 此内建函数的稳定版本可在整数上获取。
#[rustc_const_unstable(feature = "core_intrinsics", issue = "none")]
#[rustc_nounwind]
#[rustc_intrinsic]
#[miri::intrinsic_fallback_is_spec]
pub const fn carrying_mul_add<T: [const] fallback::CarryingMulAdd<Unsigned = U>, U>(
    multiplier: T,
    multiplicand: T,
    addend: T,
    carry: T,
) -> (U, T) {
    multiplier.carrying_mul_add(multiplicand, addend, carry)
}

/// 执行精确除法，导致未定义行为
/// `x % y != 0` or `y == 0` or `x == T::MIN && y == -1`
///
/// 此内建函数没有稳定的对应版本
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const unsafe fn exact_div<T: Copy>(x: T, y: T) -> T;

/// 执行未检查除法，导致未定义行为
/// where `y == 0` or `x == T::MIN && y == -1`
///
/// Safe wrappers for this intrinsic are available on the integer
/// primitives via the `checked_div` method. For example,
/// [`u32::checked_div`]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const unsafe fn unchecked_div<T: Copy>(x: T, y: T) -> T;
/// Returns the remainder of an unchecked division, resulting in
/// undefined behavior when `y == 0` or `x == T::MIN && y == -1`
///
/// 返回未检查左移的结果，导致
/// primitives via the `checked_rem` method. For example,
/// [`u32::checked_rem`]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const unsafe fn unchecked_rem<T: Copy>(x: T, y: T) -> T;

/// Performs an unchecked left shift, resulting in undefined behavior when
/// `y < 0` or `y >= N`, where N is the width of T in bits.
///
/// Safe wrappers for this intrinsic are available on the integer
/// primitives via the `checked_shl` method. For example,
/// [`u32::checked_shl`]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const unsafe fn unchecked_shl<T: Copy, U: Copy>(x: T, y: U) -> T;
/// Performs an unchecked right shift, resulting in undefined behavior when
/// `y < 0` or `y >= N`, where N is the width of T in bits.
///
/// Safe wrappers for this intrinsic are available on the integer
/// primitives via the `checked_shr` method. For example,
/// [`u32::checked_shr`]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const unsafe fn unchecked_shr<T: Copy, U: Copy>(x: T, y: U) -> T;

/// 返回未检查加法的结果，导致
/// undefined behavior when `x + y > T::MAX` or `x + y < T::MIN`.
///
/// The stable counterpart of this intrinsic is `unchecked_add` on the various
/// integer types, such as [`u16::unchecked_add`] and [`i64::unchecked_add`].
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const unsafe fn unchecked_add<T: Copy>(x: T, y: T) -> T;

/// Returns the result of an unchecked subtraction, resulting in
/// undefined behavior when `x - y > T::MAX` or `x - y < T::MIN`.
///
/// The stable counterpart of this intrinsic is `unchecked_sub` on the various
/// integer types, such as [`u16::unchecked_sub`] and [`i64::unchecked_sub`].
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const unsafe fn unchecked_sub<T: Copy>(x: T, y: T) -> T;

/// Returns the result of an unchecked multiplication, resulting in
/// undefined behavior when `x * y > T::MAX` or `x * y < T::MIN`.
///
/// The stable counterpart of this intrinsic is `unchecked_mul` on the various
/// integer types, such as [`u16::unchecked_mul`] and [`i64::unchecked_mul`].
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const unsafe fn unchecked_mul<T: Copy>(x: T, y: T) -> T;

/// Performs rotate left.
///
/// 注意，与大多数内建函数不同，调用此函数是安全的；
/// it does not require an `unsafe` block.
/// 因此，实现不得要求用户遵守任何安全不变量
/// 任何安全不变量
///
/// 此内建函数的稳定版本可在整数 primitives 上获得
/// primitives via the `rotate_left` method. For example,
/// [`u32::rotate_left`]
#[rustc_nounwind]
#[rustc_intrinsic]
#[rustc_allow_const_fn_unstable(const_trait_impl)]
#[cfg_attr(miri, track_caller)]
#[miri::intrinsic_fallback_is_spec]
pub const fn rotate_left<T: fallback::FunnelShift>(x: T, shift: u32) -> T {
    // Make sure to call the intrinsic for `funnel_shl`, not the fallback impl.
    // SAFETY: we modulo `shift` so that the result is definitely less than the size of
    // `T` in bits.
    unsafe { unchecked_funnel_shl(x, x, shift % (mem::size_of::<T>() as u32 * 8)) }
}

/// 执行右旋转操作
///
/// 注意，与大多数内建函数不同，调用此函数是安全的；
/// it does not require an `unsafe` block.
/// 因此，实现不得要求用户遵守任何安全不变量
/// 任何安全不变量
///
/// 此内建函数的稳定版本可在整数 primitives 上获得
/// primitives via the `rotate_right` method. For example,
/// [`u32::rotate_right`]
#[rustc_nounwind]
#[rustc_intrinsic]
#[rustc_allow_const_fn_unstable(const_trait_impl)]
#[cfg_attr(miri, track_caller)]
#[miri::intrinsic_fallback_is_spec]
pub const fn rotate_right<T: fallback::FunnelShift>(x: T, shift: u32) -> T {
    // Make sure to call the intrinsic for `funnel_shr`, not the fallback impl.
    // SAFETY: we modulo `shift` so that the result is definitely less than the size of
    // `T` in bits.
    unsafe { unchecked_funnel_shr(x, x, shift % (mem::size_of::<T>() as u32 * 8)) }
}

/// Wrapping (modular) addition. Computes `a + b`,
/// 在类型边界处进行包裹。
///
/// 注意，与大多数内联函数不同，调用此函数是安全的；
/// it does not require an `unsafe` block.
/// 因此，实现不得要求用户遵守任何安全不变量。
/// 任何安全不变量。
///
/// 该内联函数的稳定版本可在整数库中找到。
/// primitives via the `wrapping_add` method. For example,
/// [`u32::wrapping_add`]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn wrapping_add<T: Copy>(a: T, b: T) -> T;
/// Wrapping (modular) subtraction. Computes `a - b`,
/// 在类型边界处进行包裹。
///
/// 注意，与大多数内联函数不同，调用此函数是安全的；
/// it does not require an `unsafe` block.
/// 因此，实现不得要求用户遵守任何安全不变量。
/// 任何安全不变量。
///
/// 该内联函数的稳定版本可在整数库中找到。
/// primitives via the `wrapping_sub` method. For example,
/// [`u32::wrapping_sub`]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn wrapping_sub<T: Copy>(a: T, b: T) -> T;
/// 包裹式（模块化）乘法。计算 `a * b`，在类型边界处进行包裹。
/// 注意，与大多数内联函数不同，调用此函数是安全的；
///
/// Note that, unlike most intrinsics, this is safe to call;
/// it does not require an `unsafe` block.
/// 因此，实现不得要求用户遵守任何安全不变量。
/// 任何安全不变量。
///
/// 该内联函数的稳定版本可在整数库中找到。
/// primitives via the `wrapping_mul` method. For example,
/// [`u32::wrapping_mul`]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn wrapping_mul<T: Copy>(a: T, b: T) -> T;

/// Computes `a + b`, saturating at numeric bounds.
///
/// 注意，与大多数内联函数不同，调用此函数是安全的；
/// it does not require an `unsafe` block.
/// 因此，实现不得要求用户遵守任何安全不变量。
/// 任何安全不变量。
///
/// 该内联函数的稳定版本可在整数库中找到。
/// primitives via the `saturating_add` method. For example,
/// [`u32::saturating_add`]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn saturating_add<T: Copy>(a: T, b: T) -> T;
/// Computes `a - b`, saturating at numeric bounds.
///
/// 注意，与大多数内联函数不同，调用此函数是安全的；
/// it does not require an `unsafe` block.
/// 因此，实现不得要求用户遵守任何安全不变量。
/// 任何安全不变量。
///
/// 该内联函数的稳定版本可在整数库中找到。
/// primitives via the `saturating_sub` method. For example,
/// [`u32::saturating_sub`]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn saturating_sub<T: Copy>(a: T, b: T) -> T;

/// 漏斗式左移。
///
/// Concatenates `a` and `b` (with `a` in the most significant half),
/// 生成宽度为原来的两倍的整数。然后将该整数左移
/// by `shift`), and extract the most significant half. If `a` and `b`
/// 相同，这相当于左旋转操作。
///
/// It is undefined behavior if `shift` is greater than or equal to the
/// bit size of `T`.
///
/// Safe versions of this intrinsic are available on the integer primitives
/// via the `funnel_shl` method. For example, [`u32::funnel_shl`].
#[rustc_intrinsic]
#[rustc_nounwind]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_do_not_const_check] // Use built-in impl to avoid const-checks in the fallback body.
pub const unsafe fn unchecked_funnel_shl<T: fallback::FunnelShift>(a: T, b: T, shift: u32) -> T {
    // SAFETY: caller ensures that `shift` is in-range
    unsafe { a.unchecked_funnel_shl(b, shift) }
}

/// Funnel Shift right.
///
/// Concatenates `a` and `b` (with `a` in the most significant half),
/// creating an integer twice as wide. Then shift this integer right
/// by `shift` (taken modulo the bit size of `T`), and extract the
/// least significant half. If `a` and `b` are the same, this is equivalent
/// to a rotate right operation.
///
/// It is undefined behavior if `shift` is greater than or equal to the
/// bit size of `T`.
///
/// Safer versions of this intrinsic are available on the integer primitives
/// via the `funnel_shr` method. For example, [`u32::funnel_shr`]
#[rustc_intrinsic]
#[rustc_nounwind]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_do_not_const_check] // Ise built-in impl to avoid const-checks in the fallback body.
pub const unsafe fn unchecked_funnel_shr<T: fallback::FunnelShift>(a: T, b: T, shift: u32) -> T {
    // SAFETY: caller ensures that `shift` is in-range
    unsafe { a.unchecked_funnel_shr(b, shift) }
}

/// Carryless multiply.
///
/// Safe versions of this intrinsic are available on the integer primitives
/// via the `carryless_mul` method. For example, [`u32::carryless_mul`].
#[rustc_intrinsic]
#[rustc_nounwind]
#[rustc_const_unstable(feature = "core_intrinsics", issue = "none")]
#[miri::intrinsic_fallback_is_spec]
pub const fn carryless_mul<T: [const] fallback::CarrylessMul>(a: T, b: T) -> T {
    a.carryless_mul(b)
}

/// This is an implementation detail of [`crate::ptr::read`] and should
/// 此 intrinsic *只能* 在指针为局部指针且没有
///
/// This intrinsic can *only* be called where the pointer is a local without
/// projections (`read_via_copy(ptr)`, not `read_via_copy(*ptr)`) so that it
/// trivially obeys runtime-MIR rules about derefs in operands.
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const unsafe fn read_via_copy<T>(ptr: *const T) -> T;

/// This is an implementation detail of [`crate::ptr::write`] and should
/// 此 intrinsic *只能* 在指针为局部指针且没有
///
/// This intrinsic can *only* be called where the pointer is a local without
/// projections (`write_via_move(ptr, x)`, not `write_via_move(*ptr, x)`) so
/// 返回 'v' 中变体的判别式值。
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const unsafe fn write_via_move<T>(ptr: *mut T, value: T);

/// Returns the value of the discriminant for the variant in 'v';
/// if `T` has no discriminant, returns `0`.
///
/// Note that, unlike most intrinsics, this is safe to call;
/// it does not require an `unsafe` block.
/// Therefore, implementations must not require the user to uphold
/// any safety invariants.
///
/// The stabilized version of this intrinsic is [`core::mem::discriminant`].
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn discriminant_value<T>(v: &T) -> <T as DiscriminantKind>::Discriminant;

/// Rust's "try catch" construct for unwinding. Invokes the function pointer `try_fn` with the
/// data pointer `data`, and calls `catch_fn` if unwinding occurs while `try_fn` runs.
/// Returns `true` if unwinding occurred and `catch_fn` was called; returns `false` otherwise.
///
/// `catch_fn` must not unwind.
///
/// The third argument is a function called if an unwind occurs (both Rust `panic` and foreign
/// 展开。此函数接收数据指针和指向目标及
/// 运行时特定异常对象的指针。
///
/// 请注意，在外部展开操作的情况下，异常对象数据可能无法
/// 从 Rust 中安全使用，不应通过标准库直接暴露。为了
/// 防止不安全访问，库实现可能终止进程或向用户呈现
/// 不透明的错误类型。
///
/// 有关更多信息，请参阅编译器的源代码以及此内建函数的稳定
/// version of this intrinsic, `std::panic::catch_unwind`.
#[rustc_intrinsic]
#[rustc_nounwind]
pub unsafe fn catch_unwind<Data: ptr::Thin>(
    _try_fn: unsafe fn(*mut Data),
    _data: *mut Data,
    _catch_fn: unsafe fn(*mut Data, *mut u8),
) -> bool;

/// Emits a `nontemporal` store, which gives a hint to the CPU that the data should not be held
/// in cache. Except for performance, this is fully equivalent to `ptr.write(val)`.
///
/// Not all architectures provide such an operation. For instance, x86 does not: while `MOVNT`
/// exists, that operation is *not* equivalent to `ptr.write(val)` (`MOVNT` writes can be reordered
/// 以常规写入不允许的方式）。
#[rustc_intrinsic]
#[rustc_nounwind]
pub unsafe fn nontemporal_store<T>(ptr: *mut T, val: T);

/// See documentation of `<*const T>::offset_from` for details.
#[rustc_intrinsic_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const unsafe fn ptr_offset_from<T>(ptr: *const T, base: *const T) -> isize;

/// See documentation of `<*const T>::offset_from_unsigned` for details.
#[rustc_nounwind]
#[rustc_intrinsic]
#[rustc_intrinsic_const_stable_indirect]
pub const unsafe fn ptr_offset_from_unsigned<T>(ptr: *const T, base: *const T) -> usize;

/// See documentation of `<*const T>::guaranteed_eq` for details.
/// Returns `2` if the result is unknown.
/// Returns `1` if the pointers are guaranteed equal.
/// Returns `0` if the pointers are guaranteed inequal.
#[rustc_intrinsic]
#[rustc_nounwind]
#[rustc_do_not_const_check]
#[inline]
#[miri::intrinsic_fallback_is_spec]
pub const fn ptr_guaranteed_cmp<T>(ptr: *const T, other: *const T) -> u8 {
    (ptr == other) as u8
}

/// 判断两个值的原始字节是否相等。
///
/// This is particularly handy for arrays, since it allows things like just
/// comparing `i96`s instead of forcing `alloca`s for `[6 x i16]`.
///
/// Above some backend-decided threshold this will emit calls to `memcmp`,
/// like slice equality does, instead of causing massive code size.
///
/// Since this works by comparing the underlying bytes, the actual `T` is
/// # 安全性
/// but any validity restrictions will be ignored, not enforced.
///
/// # Safety
///
/// It's UB to call this if any of the *bytes* in `*a` or `*b` are uninitialized.
/// （实现允许根据比较结果进行分支，
/// fully-initialized: if `T` has padding, it's UB to call this intrinsic.
///
/// At compile-time, it is furthermore UB to call this if any of the bytes
/// in `*a` or `*b` have provenance.
///
/// (The implementation is allowed to branch on the results of comparisons,
/// which is UB if any of their inputs are `undef`.)
#[rustc_nounwind]
#[rustc_intrinsic]
#[lang = "raw_eq"]
pub const unsafe fn raw_eq<T>(a: &T, b: &T) -> bool;

/// Lexicographically compare `[left, left + bytes)` and `[right, right + bytes)`
/// as unsigned bytes, returning negative if `left` is less, zero if all the
/// bytes match, or positive if `left` is greater.
///
/// This underlies things like `<[u8]>::cmp`, and will usually lower to `memcmp`.
///
/// # 安全性
///
/// `left` and `right` must each be [valid] for reads of `bytes` bytes.
///
/// 请注意，这适用于整个范围，而不仅仅是第一个不同的字节之前。这允许以大块方式进行优化。
/// that differs.  That allows optimizations that can read in large chunks.
///
/// [valid]: crate::ptr#safety
#[rustc_nounwind]
#[rustc_intrinsic]
#[rustc_const_unstable(feature = "const_cmp", issue = "143800")]
#[lang = "compare_bytes"]
pub const unsafe fn compare_bytes(left: *const u8, right: *const u8, bytes: usize) -> i32;

/// See documentation of [`std::hint::black_box`] for details.
///
/// [`std::hint::black_box`]: crate::hint::black_box
#[rustc_nounwind]
#[rustc_intrinsic]
#[rustc_intrinsic_const_stable_indirect]
pub const fn black_box<T>(dummy: T) -> T;

/// 根据上下文选择要调用的函数。
///
/// 如果此函数在编译时评估，则对此
/// intrinsic will be replaced with a call to `called_in_const`. It gets
/// replaced with a call to `called_at_rt` otherwise.
///
/// 此函数可以安全调用，但请注意下面的稳定性问题。
///
/// # 类型要求
///
/// The two functions must be both function items. They cannot be function
/// pointers or closures. The first function must be a `const fn`.
///
/// `arg` will be the tupled arguments that will be passed to either one of
/// 两个函数必须都返回 RET。
/// # 稳定性问题
///
/// # Stability concerns
///
/// Rust has not yet decided that `const fn` are allowed to tell whether
/// 内建函数时，如果可以从稳定版本访问，则至关重要的是
/// intrinsic anywhere that can be reached from stable, it is crucial that
/// the end-to-end behavior of the stable `const fn` is the same for both
/// 这是可能导致问题的一个例子：
/// 目前这样的断言总是会成功；除非 Rust 另有决定，否则不应违反这一原则。
/// 这是一个宏，用于简化 const_eval_select 的调用。使用方式如下：
///
/// Here is an example of how this could cause a problem:
/// ```no_run
/// #![feature(const_eval_select)]
/// #![feature(core_intrinsics)]
/// # #![allow(internal_features)]
/// use std::intrinsics::const_eval_select;
///
/// // Standard library
/// pub const fn inconsistent() -> i32 {
///     fn runtime() -> i32 { 1 }
///     const fn compiletime() -> i32 { 2 }
///
///     // ⚠ This code violates the required equivalence of `compiletime`
///     // and `runtime`.
///     const_eval_select((), compiletime, runtime)
/// }
///
/// // User Crate
/// const X: i32 = inconsistent();
/// let x = inconsistent();
/// assert_eq!(x, X);
/// ```
///
/// Currently such an assertion would always succeed; until Rust decides
/// otherwise, that principle should not be violated.
#[rustc_const_unstable(feature = "const_eval_select", issue = "124625")]
#[rustc_intrinsic]
pub const fn const_eval_select<ARG: Tuple, F, G, RET>(
    _arg: ARG,
    _called_in_const: F,
    _called_at_rt: G,
) -> RET
where
    G: FnOnce<ARG, Output = RET>,
    F: const FnOnce<ARG, Output = RET>;

/// A macro to make it easier to invoke const_eval_select. Use as follows:
/// ```rust,ignore (just a macro example)
/// const_eval_select!(
///     @capture { arg1: i32 = some_expr, arg2: T = other_expr } -> U:
///     if const #[attributes_for_const_arm] {
///         // Compile-time code goes here.
///     } else #[attributes_for_runtime_arm] {
///         // Run-time code goes here.
///     }
/// )
/// ```
/// The `@capture` block declares which surrounding variables / expressions can be
/// used inside the `if const`.
/// Note that the two arms of this `if` really each become their own function, which is why the
/// macro supports setting attributes for those functions. Both functions are marked as `#[inline]`.
///
/// See [`const_eval_select()`] for the rules and requirements around that intrinsic.
pub(crate) macro const_eval_select {
    (
        @capture$([$($binders:tt)*])? { $($arg:ident : $ty:ty = $val:expr),* $(,)? } $( -> $ret:ty )? :
        if const
            $(#[$compiletime_attr:meta])* $compiletime:block
        else
            $(#[$runtime_attr:meta])* $runtime:block
    ) => {{
        #[inline]
        $(#[$runtime_attr])*
        fn runtime$(<$($binders)*>)?($($arg: $ty),*) $( -> $ret )? {
            $runtime
        }

        #[inline]
        $(#[$compiletime_attr])*
        const fn compiletime$(<$($binders)*>)?($($arg: $ty),*) $( -> $ret )? {
            // Don't warn if one of the arguments is unused.
            $(let _ = $arg;)*

            $compiletime
        }

        const_eval_select(($($val,)*), compiletime, runtime)
    }},
    // We support leaving away the `val` expressions for *all* arguments
    // (but not for *some* arguments, that's too tricky).
    (
        @capture$([$($binders:tt)*])? { $($arg:ident : $ty:ty),* $(,)? } $( -> $ret:ty )? :
        if const
            $(#[$compiletime_attr:meta])* $compiletime:block
        else
            $(#[$runtime_attr:meta])* $runtime:block
    ) => {
        $crate::intrinsics::const_eval_select!(
            @capture$([$($binders)*])? { $($arg : $ty = $arg),* } $(-> $ret)? :
            if const
                $(#[$compiletime_attr])* $compiletime
            else
                $(#[$runtime_attr])* $runtime
        )
    },
}

/// 返回参数值是否在编译时已知。
/// 即可知。
///
/// 当存在一种编写方式能够
/// be *faster* when some variables have known values, but *slower*
/// in the general case: an `if is_val_statically_known(var)` can be used
/// to select between these two variants. The `if` will be optimized away
/// and only the desired branch remains.
///
/// Formally speaking, this function non-deterministically returns `true`
/// or `false`, and the caller has to ensure sound behavior for both cases.
/// 这也意味着以下代码的行为未指定；它
///
/// ```no_run
/// #![feature(core_intrinsics)]
/// # #![allow(internal_features)]
/// use std::hint::unreachable_unchecked;
/// use std::intrinsics::is_val_statically_known;
///
/// if !is_val_statically_known(0) { unsafe { unreachable_unchecked(); } }
/// ```
///
/// 可能会 *panic*，也可能不会：
/// may panic, or it may not:
///
/// ```no_run
/// #![feature(core_intrinsics)]
/// # #![allow(internal_features)]
/// use std::intrinsics::is_val_statically_known;
///
/// assert_eq!(is_val_statically_known(0), is_val_statically_known(0));
/// ```
///
/// Unsafe code may not rely on `is_val_statically_known` returning any
/// 该值。
/// return `true` only if the value of the argument is actually known.
///
/// # 类型要求
///
/// `T` must be either a `bool`, a `char`, a primitive numeric type (e.g. `f32`,
/// but not `NonZeroISize`), or any thin pointer (e.g. `*mut String`).
/// 其他任何参数类型*可能导致*编译器报错。
///
/// ## 指针
///
/// 当输入为指针时，只考虑指针本身。指针目标没有影响。目前，这些函数
/// 行为相同：
/// 对单个值的非重叠 *有类型* 交换。
///
/// ```
/// #![feature(core_intrinsics)]
/// # #![allow(internal_features)]
/// use std::intrinsics::is_val_statically_known;
///
/// fn foo(x: &i32) -> bool {
///     is_val_statically_known(x)
/// }
///
/// fn bar(x: &i32) -> bool {
///     is_val_statically_known(
///         (x as *const i32).addr()
///     )
/// }
/// # _ = foo(&5_i32);
/// # _ = bar(&5_i32);
/// ```
#[rustc_const_stable_indirect]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn is_val_statically_known<T: Copy>(_arg: T) -> bool {
    false
}

/// 代码生成后端会在
///
/// The codegen backends will replace this with a better implementation when
/// `T` is a simple type that can be loaded and stored as an immediate.
///
/// The stabilized form of this intrinsic is [`crate::mem::swap`].
///
/// # 如果违反以下任何条件，行为未定义：
/// Behavior is undefined if any of the following conditions are violated:
///
/// * Both `x` and `y` must be [valid] for both reads and writes.
///
/// * Both `x` and `y` must be properly aligned.
///
/// * The region of memory beginning at `x` must *not* overlap with the region of memory
///   beginning at `y`.
///
/// * The memory pointed by `x` and `y` must both contain values of type `T`.
///
/// [valid]: crate::ptr#safety
#[rustc_nounwind]
#[inline]
#[rustc_intrinsic]
pub const unsafe fn typed_swap_nonoverlapping<T>(x: *mut T, y: *mut T) {
    // SAFETY: The caller provided single non-overlapping items behind
    // pointers, so swapping them with `count: 1` is fine.
    unsafe { ptr::swap_nonoverlapping(x, y, 1) };
}

/// 返回是否在运行时进行未定义行为检查。这最终会评估为
/// `cfg!(ub_checks)`, but behaves different from `cfg!` when mixing crates built with different
/// flags: if the crate has UB checks enabled or carries the `#[rustc_preserve_ub_checks]`
/// 属性，评估会延迟到单态化（或调用内联到
/// 不进一步延迟评估的 crate）时；否则可以在任何时间发生。
///
/// The common case here is a user program built with ub_checks linked against the distributed
/// sysroot which is built without ub_checks but with `#[rustc_preserve_ub_checks]`.
/// 当 *用户 crate* 启用了 UB 检查时，所有断言都会启用。然而，如果用户关闭了 UB 检查，这些检查仍会被优化掉。
/// `#[inline]`), gating assertions on `ub_checks()` rather than `cfg!(ub_checks)` means that
/// assertions are enabled whenever the *user crate* has UB checks enabled. However, if the
/// 不同 crate 的配置文件可能不同，但我们需要此函数在 consteval 中始终返回相同的值，以避免不安全性问题。
/// primarily used by [`crate::ub_checks::assert_unsafe_precondition`].
///
/// # 评估会被延迟到单态化时（或直到调用被内联到不进一步延迟评估的 crate 中）；否则，评估可以在任何时间发生。
///
/// In consteval, this function currently returns `true`. This is because the value of the `ub_checks`
/// 不同 crate 的配置文件可能不同，但我们需要此函数在 consteval 中始终返回相同的值，以避免不安全性问题。
/// 在编译时分配一块内存。
#[inline(always)]
#[rustc_intrinsic]
pub const fn ub_checks() -> bool {
    cfg!(ub_checks)
}

/// 在运行时仅返回空指针。
/// `cfg!(overflow_checks)`, but behaves different from `cfg!` when mixing crates built with different
/// flags: if the crate has overflow checks enabled or carries the `#[rustc_inherit_overflow_checks]`
/// - 如果违反此约束，在编译时会出现编译错误。
/// - 在运行时不会进行检查。
///
/// The common case here is a user program built with overflow_checks linked against the distributed
/// sysroot which is built without overflow_checks but with `#[rustc_inherit_overflow_checks]`.
/// For code that gets monomorphized in the user crate (i.e., generic functions and functions with
/// `#[inline]`), gating assertions on `overflow_checks()` rather than `cfg!(overflow_checks)` means that
/// assertions are enabled whenever the *user crate* has overflow checks enabled. However if the
/// user has overflow checks disabled, the checks will still get optimized out.
///
/// # Consteval
///
/// In consteval, this function currently returns `true`. This is because the value of the `overflow_checks`
/// configuration can differ across crates, but we need this function to always return the same
/// value in consteval in order to avoid unsoundness.
#[inline(always)]
#[rustc_intrinsic]
pub const fn overflow_checks() -> bool {
    cfg!(overflow_checks)
}

/// Allocates a block of memory at compile time.
/// At runtime, just returns a null pointer.
///
/// # Safety
///
/// - The `align` argument must be a power of two.
/// - At compile time, a compile error occurs if this constraint is violated.
/// - At runtime, it is not checked.
#[rustc_const_unstable(feature = "const_heap", issue = "79597")]
#[rustc_nounwind]
#[rustc_intrinsic]
#[miri::intrinsic_fallback_is_spec]
pub const unsafe fn const_allocate(_size: usize, _align: usize) -> *mut u8 {
    // const eval overrides this function, but runtime code for now just returns null pointers.
    // See <https://github.com/rust-lang/rust/issues/93935>.
    crate::ptr::null_mut()
}

/// Deallocates a memory which allocated by `intrinsics::const_allocate` at compile time.
/// 在运行时，它不做任何操作。
///
/// # 安全性
///
/// - The `align` argument must be a power of two.
/// - 如果违反此约束条件，在编译时会出现编译错误。
/// - 在运行时不会进行检查。
/// - If the `ptr` is created in an another const, this intrinsic doesn't deallocate it.
/// - If the `ptr` is pointing to a local variable, this intrinsic doesn't deallocate it.
#[rustc_const_unstable(feature = "core_intrinsics", issue = "none")]
#[rustc_nounwind]
#[rustc_intrinsic]
#[miri::intrinsic_fallback_is_spec]
pub const unsafe fn const_deallocate(_ptr: *mut u8, _size: usize, _align: usize) {
    // Runtime NOP
}

/// 将该指针指向的分配转换为不可变的全局内存。
/// 指针必须指向堆分配的开头位置。
/// 此操作仅在编译时有效。在运行时，它不做任何操作。
#[rustc_const_unstable(feature = "const_heap", issue = "79597")]
#[rustc_nounwind]
#[rustc_intrinsic]
#[miri::intrinsic_fallback_is_spec]
pub const unsafe fn const_make_global(ptr: *mut u8) -> *const u8 {
    // const eval overrides this function; at runtime, it is a NOP.
    ptr
}

/// Check if the pre-condition `cond` has been met.
///
/// By default, if `contract_checks` is enabled, this will panic with no unwind if the condition
/// 返回 false 时，会无回溯地引发 panic。
///
/// 注意，此函数在常量评估期间是无操作的。
#[unstable(feature = "contracts_internals", issue = "128044")]
// Calls to this function get inserted by an AST expansion pass, which uses the equivalent of
// `#[allow_internal_unstable]` to allow using `contracts_internals` functions. Const-checking
// doesn't honor `#[allow_internal_unstable]`, so for the const feature gate we use the user-facing
// `contracts` feature rather than the perma-unstable `contracts_internals`
#[rustc_const_unstable(feature = "contracts", issue = "128044")]
#[lang = "contract_check_requires"]
#[rustc_intrinsic]
pub const fn contract_check_requires<C: Fn() -> bool + Copy>(cond: C) {
    const_eval_select!(
        @capture[C: Fn() -> bool + Copy] { cond: C } :
        if const {
                // Do nothing
        } else {
            if !cond() {
                // Emit no unwind panic in case this was a safety requirement.
                crate::panicking::panic_nounwind("failed requires check");
            }
        }
    )
}

/// Check if the post-condition `cond` has been met.
///
/// By default, if `contract_checks` is enabled, this will panic with no unwind if the condition
/// 返回 false 时，会无回溯地引发 panic。
///
/// If `cond` is `None`, then no postcondition checking is performed.
///
/// 注意，此函数在常量评估期间是无操作的。
#[unstable(feature = "contracts_internals", issue = "128044")]
// Similar to `contract_check_requires`, we need to use the user-facing
// `contracts` feature rather than the perma-unstable `contracts_internals`.
// Const-checking doesn't honor allow_internal_unstable logic used by contract expansion.
#[rustc_const_unstable(feature = "contracts", issue = "128044")]
#[lang = "contract_check_ensures"]
#[rustc_intrinsic]
pub const fn contract_check_ensures<C: Fn(&Ret) -> bool + Copy, Ret>(
    cond: Option<C>,
    ret: Ret,
) -> Ret {
    const_eval_select!(
        @capture[C: Fn(&Ret) -> bool + Copy, Ret] { cond: Option<C>, ret: Ret } -> Ret :
        if const {
            // Do nothing
            ret
        } else {
            if let crate::option::Option::Some(cond) = cond && !cond(&ret) {
                // Emit no unwind panic in case this was a safety requirement.
                crate::panicking::panic_nounwind("failed ensures check");
            }
            ret
        }
    )
}

/// 内建函数将返回该 vtable 中存储的大小。
///
/// # 安全性
///
/// `ptr` must point to a vtable.
#[rustc_nounwind]
#[rustc_intrinsic]
pub unsafe fn vtable_size(ptr: *const ()) -> usize;

/// 内建函数将返回该 vtable 中存储的对齐信息。
///
/// # 安全性
///
/// `ptr` must point to a vtable.
#[rustc_nounwind]
#[rustc_intrinsic]
pub unsafe fn vtable_align(ptr: *const ()) -> usize;

/// 类型的大小，以字节为单位。
///
/// 注意，与大多数内建函数不同，调用此函数是安全的；
/// it does not require an `unsafe` block.
/// 因此，实现不得要求用户遵守
/// 任何安全性约束条件。
///
/// 更具体地说，这是同一类型中连续项之间的字节偏移量，
/// 包括对齐填充。
///
/// 注意，与大多数内建函数不同，此函数只能在编译时调用，
/// 因为后端没有对应的实现。唯一的调用者（其稳定版本）
/// stable counterpart) wraps this intrinsic call in a `const` block so that
/// 后端只能看到已计算的常量。
///
/// The stabilized version of this intrinsic is [`core::mem::size_of`].
#[rustc_nounwind]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_intrinsic]
#[rustc_comptime]
pub fn size_of<T>() -> usize;

/// 类型的最小对齐程度。
///
/// 注意，与大多数内建函数不同，调用此函数是安全的；
/// it does not require an `unsafe` block.
/// 因此，实现不得要求用户遵守
/// 任何安全性约束条件。
///
/// 注意，与大多数内建函数不同，此函数只能在编译时调用，
/// 因为后端没有对应的实现。唯一的调用者（其
/// stable counterpart) wraps this intrinsic call in a `const` block so that
/// 后端仅看到已计算常量。
///
/// The stabilized version of this intrinsic is [`core::mem::align_of`].
#[rustc_nounwind]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_intrinsic]
#[rustc_comptime]
pub fn align_of<T>() -> usize;

/// 类型中字段的偏移量。
///
/// 注意，与大多数内建函数不同，调用此函数是安全的；
/// it does not require an `unsafe` block.
/// 因此，实现不得要求用户遵守任何安全不变量。
/// 此内建只能在编译时计算，且应仅出现在
///
/// 常量或内联 const 块中。
/// constants or inline const blocks.
///
/// The stabilized version of this intrinsic is [`core::mem::offset_of`].
/// This intrinsic is also a lang item so `offset_of!` can desugar to calls to it.
#[rustc_nounwind]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_intrinsic]
#[lang = "offset_of"]
#[rustc_comptime]
pub fn offset_of<T: PointeeSized>(variant: u32, field: u32) -> usize;

/// 由类型表示的字段所查询的字段的偏移量。
///
/// Returns the offset of the field represented by `F`. This function essentially does the same as
/// the [`offset_of`] intrinsic, but expects the field to be represented by a generic rather than
/// 变体和字段索引表示。这同样是一个安全的内建函数，且只能在
/// 编译时计算，因此应仅出现在常量或内联 const 块中。
///
/// 无需手动调用此内建，因为其值用于定义
/// [`Field::OFFSET`](crate::field::Field::OFFSET), which is publicly accessible.
#[rustc_intrinsic]
#[rustc_comptime]
pub fn field_offset<F: crate::field::Field>() -> usize;

/// Returns the number of variants of the type `T` cast to a `usize`;
/// if `T` has no variants, returns `0`. Uninhabited variants will be counted.
///
/// 注意，与大多数内建函数不同，此函数只能在编译时调用
/// 因为后端没有其实现。唯一的调用者（即
/// stable counterpart) wraps this intrinsic call in a `const` block so that
/// 后端仅看到已计算常量。
///
/// The to-be-stabilized version of this intrinsic is [`crate::mem::variant_count`].
#[rustc_nounwind]
#[rustc_intrinsic]
#[rustc_comptime]
pub fn variant_count<T>() -> usize;

/// 引用值的大小（以字节为单位）。
///
/// The stabilized version of this intrinsic is [`core::mem::size_of_val`].
///
/// # 安全性
///
/// See [`crate::mem::size_of_val_raw`] for safety conditions.
#[rustc_nounwind]
#[rustc_intrinsic]
#[rustc_intrinsic_const_stable_indirect]
pub const unsafe fn size_of_val<T: ?Sized>(ptr: *const T) -> usize;

/// 引用值所需的对齐方式。
///
/// The stabilized version of this intrinsic is [`core::mem::align_of_val`].
///
/// # 安全性
///
/// See [`crate::mem::align_of_val_raw`] for safety conditions.
#[rustc_nounwind]
#[rustc_intrinsic]
#[rustc_intrinsic_const_stable_indirect]
pub const unsafe fn align_of_val<T: ?Sized>(ptr: *const T) -> usize;

/// 获取包含类型名称的静态字符串切片。
///
/// 注意，与大多数内建函数不同，此函数只能在编译时调用
/// 因为后端没有其实现。唯一的调用者（即
/// stable counterpart) wraps this intrinsic call in a `const` block so that
/// 后端仅看到一个计算过的常量。
///
/// The stabilized version of this intrinsic is [`core::any::type_name`].
#[rustc_nounwind]
#[rustc_intrinsic]
#[rustc_comptime]
pub fn type_name<T: ?Sized>() -> &'static str;

/// Gets the actual field `TypeId` of the [`FieldRepresentingType`]'s `TypeId`.
///
/// The more user-friendly version of this intrinsic is [`core::mem::type_info::FieldId::type_id`].
///
/// [`FieldRepresentingType`]: crate::field::FieldRepresentingType
#[rustc_intrinsic]
#[rustc_comptime]
pub fn field_representing_type_actual_type_id(
    _frt_type_id: crate::any::TypeId,
) -> crate::any::TypeId;

/// Gets the name of the field represented by the [`FieldRepresentingType`]'s `TypeId`.
///
/// The more user-friendly version of this intrinsic is [`core::mem::type_info::FieldId::name`].
///
/// [`FieldRepresentingType`]: crate::field::FieldRepresentingType
#[rustc_intrinsic]
#[rustc_comptime]
pub fn field_representing_type_name(_frt_type_id: crate::any::TypeId) -> &'static str;

/// Gets the name of the field represented by the [`FieldRepresentingType`]'s `TypeId`.
///
/// The more user-friendly version of this intrinsic is [`core::mem::type_info::FieldId::name`].
///
/// [`FieldRepresentingType`]: crate::field::FieldRepresentingType
#[rustc_intrinsic]
#[rustc_comptime]
pub fn field_representing_type_offset(_frt_type_id: crate::any::TypeId) -> usize;

/// Lowers in MIR to `Rvalue::Aggregate` with `AggregateKind::RawPtr`.
///
/// This is used to implement functions like `slice::from_raw_parts_mut` and
/// `ptr::from_raw_parts` in a way compatible with the compiler being able to
/// 改变指针的可能布局方式相兼容。
#[rustc_nounwind]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_intrinsic]
pub const fn aggregate_raw_ptr<P: bounds::BuiltinDeref, D, M>(data: D, meta: M) -> P
where
    <P as bounds::BuiltinDeref>::Pointee: ptr::Pointee<Metadata = M>;

/// Lowers in MIR to `Rvalue::UnaryOp` with `UnOp::PtrMetadata`.
///
/// This is used to implement functions like `ptr::metadata`.
#[rustc_nounwind]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_intrinsic]
pub const fn ptr_metadata<P: ptr::Pointee<Metadata = M> + PointeeSized, M>(ptr: *const P) -> M;

/// This is an accidentally-stable alias to [`ptr::copy_nonoverlapping`]; use that instead.
// Note (intentionally not in the doc comment): `ptr::copy_nonoverlapping` adds some extra
// debug assertions; if you are writing compiler tests or code inside the standard library
// that wants to avoid those debug assertions, directly call this intrinsic instead.
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_allowed_through_unstable_modules(
    message = "import this function via the `ptr` module instead",
    module = "ptr"
)]
#[rustc_const_stable(feature = "const_intrinsic_copy", since = "1.83.0")]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const unsafe fn copy_nonoverlapping<T>(src: *const T, dst: *mut T, count: usize);

/// This is an accidentally-stable alias to [`ptr::copy`]; use that instead.
// Note (intentionally not in the doc comment): `ptr::copy` adds some extra
// debug assertions; if you are writing compiler tests or code inside the standard library
// that wants to avoid those debug assertions, directly call this intrinsic instead.
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_allowed_through_unstable_modules(
    message = "import this function via the `ptr` module instead",
    module = "ptr"
)]
#[rustc_const_stable(feature = "const_intrinsic_copy", since = "1.83.0")]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const unsafe fn copy<T>(src: *const T, dst: *mut T, count: usize);

/// This is an accidentally-stable alias to [`ptr::write_bytes`]; use that instead.
// Note (intentionally not in the doc comment): `ptr::write_bytes` adds some extra
// debug assertions; if you are writing compiler tests or code inside the standard library
// that wants to avoid those debug assertions, directly call this intrinsic instead.
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_allowed_through_unstable_modules(
    message = "import this function via the `ptr` module instead",
    module = "ptr"
)]
#[rustc_const_stable(feature = "const_intrinsic_copy", since = "1.83.0")]
#[rustc_nounwind]
#[rustc_intrinsic]
pub const unsafe fn write_bytes<T>(dst: *mut T, val: u8, count: usize);

/// 返回两个浮点值中的最小值，忽略 NaN。
///
/// 其行为类似于 IEEE 754-2019 中的 minimumNumber，*但*不确定性地排序有符号
/// 零。具体来说：
/// 如果其中一个参数为 NaN（静默或信号），则返回另一个参数。如果
/// both arguments are NaN, returns NaN. If the inputs compare equal (such as for the case of `+0.0`
/// and `-0.0`), either input may be returned non-deterministically.
///
/// 注意，与大多数内建函数不同，调用此函数是安全的；
/// it does not require an `unsafe` block.
/// 因此，实现不得要求用户遵守
/// 任何安全不变量。
///
/// 此内建函数的稳定版本可通过 float primitives 的
/// `min` method. For example, [`f32::min`].
#[rustc_nounwind]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_intrinsic]
#[rustc_do_not_const_check]
pub const fn minimum_number_nsz<T: bounds::FloatPrimitive>(x: T, y: T) -> T {
    if x.is_nan() || y <= x {
        y
    } else {
        // Either y > x or y is a NaN.
        x
    }
}

/// 返回两个浮点值中的最大值，忽略 NaN。
///
/// 其行为类似于 IEEE 754-2019 中的 maximumNumber，*但*不确定性地排序有符号
/// 零。具体来说：
/// 如果其中一个参数为 NaN（静默或信号），则返回另一个参数。如果
/// both arguments are NaN, returns NaN. If the inputs compare equal (such as for the case of `+0.0`
/// and `-0.0`), either input may be returned non-deterministically.
///
/// 注意，与大多数内建函数不同，调用此函数是安全的；
/// it does not require an `unsafe` block.
/// 因此，实现不得要求用户遵守
/// 任何安全不变量。
///
/// 此内建函数的稳定版本可通过 float primitives 的
/// `max` method. For example, [`f32::max`].
#[rustc_nounwind]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_intrinsic]
#[rustc_do_not_const_check]
pub const fn maximum_number_nsz<T: bounds::FloatPrimitive>(x: T, y: T) -> T {
    if x.is_nan() || y >= x {
        y
    } else {
        // Either y < x or y is a NaN.
        x
    }
}

/// 返回两个浮点值中的最小值，并传播 NaN。
///
/// 其行为类似于 IEEE 754-2019 的最小值规则。具体来说：
/// 如果其中一个参数为 NaN，则根据常规 NaN 传播规则返回 NaN。
/// 对于此操作，-0.0 被认为严格小于 +0.0。
///
/// 注意，与大多数内建函数不同，调用此函数是安全的；
/// it does not require an `unsafe` block.
/// 因此，实现不得要求用户遵守
/// 任何安全不变量。
#[rustc_nounwind]
#[rustc_const_unstable(feature = "core_intrinsics", issue = "none")]
#[rustc_intrinsic]
#[rustc_do_not_const_check]
pub const fn minimum<T: bounds::FloatPrimitive>(x: T, y: T) -> T {
    if x < y {
        x
    } else if y < x {
        y
    } else if x == y {
        if x.is_sign_negative() && y.is_sign_positive() { x } else { y }
    } else {
        // At least one input is NaN. Use `+` to perform NaN propagation and quieting.
        x + y
    }
}

/// 返回两个浮点值中的最大值，并传播 NaN。
///
/// 其行为类似于 IEEE 754-2019 的最大值规则。具体来说：
/// 如果其中一个参数为 NaN，则根据常规 NaN 传播规则返回 NaN。
/// 对于此操作，-0.0 被认为严格小于 +0.0。
///
/// 注意，与大多数内建函数不同，调用此函数是安全的；
/// it does not require an `unsafe` block.
/// 因此，实现不得要求用户遵守
/// 任何安全不变量。
#[rustc_nounwind]
#[rustc_const_unstable(feature = "core_intrinsics", issue = "none")]
#[rustc_intrinsic]
#[rustc_do_not_const_check]
pub const fn maximum<T: bounds::FloatPrimitive>(x: T, y: T) -> T {
    if x > y {
        x
    } else if y > x {
        y
    } else if x == y {
        if x.is_sign_positive() && y.is_sign_negative() { x } else { y }
    } else {
        // At least one input is NaN. Use `+` to perform NaN propagation and quieting.
        x + y
    }
}

/// 返回浮点值的绝对值。
///
/// 此内建函数的稳定版本可通过 float primitives 的
/// primitives via the `abs` method. For example, [`f32::abs`].
#[rustc_nounwind]
#[rustc_intrinsic]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_do_not_const_check] // Use built-in impl to avoid const-checks in the fallback body.
#[miri::intrinsic_fallback_is_spec]
pub const fn fabs<T: bounds::FloatPrimitive>(x: T) -> T {
    T::from_bits(x.to_bits() & !T::SIGN_MASK)
}

/// Copies the sign from `y` to `x` for floating-point values.
///
/// 此内建函数的稳定版本可通过 float primitives 的
/// primitives via the `copysign` method. For example, [`f32::copysign`].
#[inline]
#[rustc_nounwind]
#[rustc_intrinsic_const_stable_indirect]
#[rustc_intrinsic]
#[rustc_do_not_const_check]
#[miri::intrinsic_fallback_is_spec]
pub const fn copysign<T: bounds::FloatPrimitive>(x: T, y: T) -> T {
    T::from_bits((x.to_bits() & !T::SIGN_MASK) | (y.to_bits() & T::SIGN_MASK))
}

/// Generates the LLVM body for the automatic differentiation of `f` using Enzyme,
/// with `df` as the derivative function and `args` as its arguments.
///
/// Used internally as the body of `df` when expanding the `#[autodiff_forward]`
/// and `#[autodiff_reverse]` attribute macros.
///
/// Type Parameters:
/// - `F`: The original function to differentiate. Must be a function item.
/// - `G`: The derivative function. Must be a function item.
/// - `T`: A tuple of arguments passed to `df`.
/// - `R`: The return type of the derivative function.
///
/// This shows where the `autodiff` intrinsic is used during macro expansion:
///
/// ```rust,ignore (macro example)
/// #[autodiff_forward(df1, Dual, Const, Dual)]
/// pub fn f1(x: &[f64], y: f64) -> f64 {
///     unimplemented!()
/// }
/// ```
///
/// 
///
/// ```rust,ignore (macro example)
/// #[rustc_autodiff]
/// #[inline(never)]
/// pub fn f1(x: &[f64], y: f64) -> f64 {
///     ::core::panicking::panic("not implemented")
/// }
/// #[rustc_autodiff(Forward, 1, Dual, Const, Dual)]
/// pub fn df1(x: &[f64], bx_0: &[f64], y: f64) -> (f64, f64) {
///     ::core::intrinsics::autodiff(f1::<>, df1::<>, (x, bx_0, y))
/// }
/// ```
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn autodiff<F, G, T: crate::marker::Tuple, R>(f: F, df: G, args: T) -> R;

/// Generates the LLVM body of a wrapper function to offload a kernel `f`.
///
/// 类型参数：
/// - `F`: The kernel to offload. Must be a function item.
/// - `T`: A tuple of arguments passed to `f`.
/// - `R`: The return type of the kernel.
///
/// 参数：
/// - `f`: The kernel function to offload.
/// - `workgroup_dim`: A 3D size specifying the number of workgroups to launch.
/// - `thread_dim`: A 3D size specifying the number of threads per workgroup.
/// - `dyn_cache`: The amount of dynamic shared memory to request for the kernel.
/// - `device_id`: The device to offload to. Use `-1` to select the default device.
/// - `args`: A tuple of arguments forwarded to `f`.
///
/// 示例用法（伪代码）：
///
/// ```rust,ignore (pseudocode)
/// fn kernel(x: *mut [f64; 128]) {
///     core::intrinsics::offload(kernel_1, [256, 1, 1], [32, 1, 1], 0, -1, (x,))
/// }
///
/// #[cfg(target_os = "linux")]
/// extern "C" {
///     pub fn kernel_1(array_b: *mut [f64; 128]);
/// }
///
/// #[cfg(not(target_os = "linux"))]
/// #[rustc_offload_kernel]
/// extern "gpu-kernel" fn kernel_1(x: *mut [f64; 128]) {
///     unsafe { (*x)[0] = 21.0 };
/// }
/// ```
///
/// 参考 Clang 关于卸载的文档：
/// <https://clang.llvm.org/docs/OffloadingDesign.html>.
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn offload<F, T: crate::marker::Tuple, R>(
    f: F,
    workgroup_dim: [u32; 3],
    thread_dim: [u32; 3],
    dyn_cache: u32,
    device_id: i32,
    args: T,
) -> R;

/// 返回系统中可用的卸载设备数量。
///
/// Use this to discover which `device_id` values are valid to pass to
/// [`offload`]. Devices are numbered from `0` to the returned value minus one.
///
/// Returns `0` if no offloading devices are present.
#[rustc_nounwind]
#[rustc_intrinsic]
pub const fn offload_get_num_devices() -> i32;

/// 通知 Miri 给定的指针具有特定的对齐方式。
#[cfg(miri)]
#[rustc_allow_const_fn_unstable(const_eval_select)]
pub(crate) const fn miri_promise_symbolic_alignment(ptr: *const (), align: usize) {
    unsafe extern "Rust" {
        /// Miri 提供的 extern 函数承诺给定的指针适合进行
        /// "symbolic" alignment checks. Will fail if the pointer is not actually aligned or `align` is
        /// 2 的幂次，则会失败。当对齐检查是具体的（这是默认情况）时，则无影响。
        fn miri_promise_symbolic_alignment(ptr: *const (), align: usize);
    }

    const_eval_select!(
        @capture { ptr: *const (), align: usize}:
        if const {
            // Do nothing.
        } else {
            // SAFETY: this call is always safe.
            unsafe {
                miri_promise_symbolic_alignment(ptr, align);
            }
        }
    )
}

/// Loads an argument of type `T` from the `va_list` `ap` and increment the
/// argument `ap` points to.
///
/// # 安全性
///
/// 此函数仅在以下情况下安全调用：
///
/// - 有下一个变量参数可用。
/// - the next argument's type must be ABI-compatible with the type `T`.
/// - the next argument must have a properly initialized value of type `T`.
///
/// 使用不兼容的类型、无效值或当
/// 没有更多变量参数时调用此函数是不安全的。
///
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn va_arg<T: VaArgSafe>(ap: &mut VaList<'_>) -> T;

/// Duplicates a variable argument list. The returned list is initially at the same position as
/// the one in `src`, but can be advanced independently.
///
/// 代码生成后端不应对此内建函数有自定义行为，它们应始终使用
/// this fallback implementation. This intrinsic *does not* map to the LLVM `va_copy` intrinsic.
///
/// 此内建函数仅作为 Miri 和常量评估的钩子存在，用于检测未定义行为
/// 当变量参数列表使用不当时。
#[rustc_intrinsic]
#[rustc_nounwind]
pub const fn va_copy<'f>(src: &VaList<'f>) -> VaList<'f> {
    // This fallback body exploits the fact that our codegen backends all just use
    // a plain memcpy to duplicate VaList. This assumption is wrong for Miri.
    assert!(!cfg!(miri), "fallback body is incorrect under Miri");

    src.duplicate()
}

/// Destroy the variable argument list `ap` after initialization with `va_start` (part of the
/// desugaring of `...`) or `va_copy`.
///
/// 代码生成后端不应为这个内联函数提供自定义实现。
/// intrinsic *does not* map to the LLVM `va_end` intrinsic.
///
/// 在所有当前目标上，此函数为无操作，但作为常量评估的钩子用于检测变量参数列表使用错误时的未定义行为。
/// 当使用错误的变量参数列表时，用于检测未定义行为。
///
/// # 安全性
///
/// `ap` must not be used to access variable arguments after this call.
///
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn va_end(ap: &mut VaList<'_>) {
    /* deliberately does nothing */
}

/// 以尽力而为的方式返回调用函数的返回地址（经过内联处理），如果当前后端不支持则返回空指针。
/// 返回准确的值属于实现质量问题，但无法提供严格保证。
/// 关于返回值没有明确保证：从形式上看，该内联函数非确定性地返回一个无来源的任意指针。
/// 注意，与大多数内联函数不同，调用此函数是安全的。因为它仅能找到立即调用者的返回地址，这是可以确定的。
///
/// 其他形式的对应 gcc 或 llvm 内联函数（可能具有不可预测的结果甚至在运行时崩溃）未被暴露。
/// Other forms of the corresponding gcc or llvm intrinsic (which can have wildly unpredictable results or even crash at runtime) are not exposed.
#[rustc_intrinsic]
#[rustc_nounwind]
pub fn return_address() -> *const () {
    core::ptr::null()
}
