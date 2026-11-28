#![allow(missing_debug_implementations)]
#![unstable(feature = "fmt_internals", reason = "internal to format_args!", issue = "none")]

//! 此文件中的所有类型和方法都被编译器在
//! `format_args!()` 的扩展/折叠过程中使用。
//!
//! 在不了解对 `format_args!()` 宏的影响之前，请勿修改它们。

use super::*;
use crate::hint::unreachable_unchecked;
use crate::ptr::NonNull;

#[derive(Copy, Clone)]
enum ArgumentType<'a> {
    Placeholder {
        // INVARIANT: `formatter` has type `fn(&T, _) -> _` for some `T`, and `value`
        // was derived from a `&'a T`.
        value: NonNull<()>,
        formatter: unsafe fn(NonNull<()>, &mut Formatter<'_>) -> Result,
        _lifetime: PhantomData<&'a ()>,
    },
    Count(u16),
}

/// 该结构体代表由 `format_args!()` 接受的通用“参数”。
///
/// 这可以是占位符参数或计数参数。
/// * 占位符参数包含一个用于格式化给定值的函数。在
/// 编译时，会确保该函数和值具有正确的类型，然后该结构体用于将参数规范化为一种类型。
///   types, and then this struct is used to canonicalize arguments to one type.
/// * 计数参数包含用于动态格式化参数的计数，如
///   function, equivalent to `exists T.(&T, fn(&T, &mut Formatter<'_>) -> Result`.
/// 格式化此占位符参数。
/// # 安全性
#[lang = "format_argument"]
#[derive(Copy, Clone)]
#[repr(align(2))] // To ensure pointers to this struct always have their lowest bit cleared.
pub struct Argument<'a> {
    ty: ArgumentType<'a>,
}

macro_rules! argument_new {
    ($t:ty, $x:expr, $f:expr) => {
        Argument {
            // INVARIANT: this creates an `ArgumentType<'a>` from a `&'a T` and
            // a `fn(&T, ...)`, so the invariant is maintained.
            ty: ArgumentType::Placeholder {
                value: NonNull::<$t>::from_ref($x).cast(),
                // The Rust ABI considers all pointers to be equivalent, so transmuting a fn(&T) to
                // fn(NonNull<()>) and calling it with a NonNull<()> that points at a T is allowed.
                // However, the CFI sanitizer does not allow this, and triggers a crash when it
                // happens.
                //
                // To avoid this crash, we use a helper function when CFI is enabled. To avoid the
                // cost of this helper function (mainly code-size) when it is not needed, we
                // transmute the function pointer otherwise.
                //
                // This is similar to what the Rust compiler does internally with vtables when KCFI
                // is enabled, where it generates trampoline functions that only serve to adjust the
                // expected type of the argument. `ArgumentType::Placeholder` is a bit like a
                // manually constructed trait object, so it is not surprising that the same approach
                // has to be applied here as well.
                //
                // It is still considered problematic (from the Rust side) that CFI rejects entirely
                // legal Rust programs, so we do not consider anything done here a stable guarantee,
                // but meanwhile we carry this work-around to keep Rust compatible with CFI and
                // KCFI.
                #[cfg(not(any(sanitize = "cfi", sanitize = "kcfi")))]
                formatter: {
                    let f: fn(&$t, &mut Formatter<'_>) -> Result = $f;
                    // SAFETY: This is only called with `value`, which has the right type.
                    unsafe { core::mem::transmute(f) }
                },
                #[cfg(any(sanitize = "cfi", sanitize = "kcfi"))]
                formatter: |ptr: NonNull<()>, fmt: &mut Formatter<'_>| {
                    let func = $f;
                    // SAFETY: This is the same type as the `value` field.
                    let r = unsafe { ptr.cast::<$t>().as_ref() };
                    (func)(r, fmt)
                },
                _lifetime: PhantomData,
            },
        }
    };
}

impl Argument<'_> {
    #[inline]
    pub const fn new_display<T: Display>(x: &T) -> Argument<'_> {
        argument_new!(T, x, <T as Display>::fmt)
    }
    #[inline]
    pub const fn new_debug<T: Debug>(x: &T) -> Argument<'_> {
        argument_new!(T, x, <T as Debug>::fmt)
    }
    #[inline]
    pub const fn new_debug_noop<T: Debug>(x: &T) -> Argument<'_> {
        argument_new!(T, x, |_: &T, _| Ok(()))
    }
    #[inline]
    pub const fn new_octal<T: Octal>(x: &T) -> Argument<'_> {
        argument_new!(T, x, <T as Octal>::fmt)
    }
    #[inline]
    pub const fn new_lower_hex<T: LowerHex>(x: &T) -> Argument<'_> {
        argument_new!(T, x, <T as LowerHex>::fmt)
    }
    #[inline]
    pub const fn new_upper_hex<T: UpperHex>(x: &T) -> Argument<'_> {
        argument_new!(T, x, <T as UpperHex>::fmt)
    }
    #[inline]
    pub const fn new_pointer<T: Pointer>(x: &T) -> Argument<'_> {
        argument_new!(T, x, <T as Pointer>::fmt)
    }
    #[inline]
    pub const fn new_binary<T: Binary>(x: &T) -> Argument<'_> {
        argument_new!(T, x, <T as Binary>::fmt)
    }
    #[inline]
    pub const fn new_lower_exp<T: LowerExp>(x: &T) -> Argument<'_> {
        argument_new!(T, x, <T as LowerExp>::fmt)
    }
    #[inline]
    pub const fn new_upper_exp<T: UpperExp>(x: &T) -> Argument<'_> {
        argument_new!(T, x, <T as UpperExp>::fmt)
    }
    #[inline]
    #[track_caller]
    pub const fn from_usize(x: &usize) -> Argument<'_> {
        if *x > u16::MAX as usize {
            panic!("Formatting argument out of range");
        }
        Argument { ty: ArgumentType::Count(*x as u16) }
    }

    /// 此参数实际上必须是占位符参数。
    ///
    /// # Safety
    ///
    /// This argument must actually be a placeholder argument.
    #[inline]
    pub(super) unsafe fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        match self.ty {
            // SAFETY:
            // Because of the invariant that if `formatter` had the type
            // `fn(&T, _) -> _` then `value` has type `&'b T` where `'b` is
            // the lifetime of the `ArgumentType`, and because references
            // and `NonNull` are ABI-compatible, this is completely equivalent
            // to calling the original function passed to `new` with the
            // original reference, which is sound.
            ArgumentType::Placeholder { formatter, value, .. } => unsafe { formatter(value, f) },
            // SAFETY: the caller promised this.
            ArgumentType::Count(_) => unsafe { unreachable_unchecked() },
        }
    }

    #[inline]
    pub(super) const fn as_u16(&self) -> Option<u16> {
        match self.ty {
            ArgumentType::Count(count) => Some(count),
            ArgumentType::Placeholder { .. } => None,
        }
    }
}
