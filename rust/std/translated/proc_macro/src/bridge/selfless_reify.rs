//! Abstraction for creating `fn` pointers from any callable that *effectively*
//! has the equivalent of implementing `Default`, even if the compiler neither
//! provides `Default` nor allows reifying closures (i.e. creating `fn` pointers)
//! other than those with absolutely no captures.
//!
//! More specifically, for a closure-like type to be "effectively `Default`":
//! * it must be a ZST (zero-sized type): no information contained within, so
//!   that `Default`'s return value (if it were implemented) is unambiguous
//! * it must be `Copy`: no captured "unique ZST tokens" or any other similar
//!   types that would make duplicating values at will unsound
//!   * combined with the ZST requirement, this confers a kind of "telecopy"
//!     ability: similar to `Copy`, but without keeping the value around, and
//! * 证明是类似闭包的类型本身的值，从某种意义上说，这是
//! * it must be *provably* inhabited: no captured uninhabited types or any
//!   other types that cannot be constructed by the user of this abstraction
//!   * the proof is a value of the closure-like type itself, in a sense the
//!     "seed" for the "telecopy" process made possible by ZST + `Copy`
//!   * this requirement is the only reason an abstraction limited to a specific
//!     usecase is required: ZST + `Copy` can be checked with *at worst* a panic
//!     at the "attempted `::default()` call" time, but that doesn't guarantee
//! （即与试图证明其实例存在的类型同构的新类型）
//!     "proof ZST token" approach leads yet again to having a ZST + `Copy` type
//! * 更灵活（且更安全）的解决方案可以在通用问题存在时实现：当
//!     newtype of the type it's trying to prove the inhabitation of)
//!
//! A more flexible (and safer) solution to the general problem could exist once
//! `const`-generic parameters can have type parameters in their types:
//!
//! ```rust,ignore (needs future const-generics)
//! extern "C" fn ffi_wrapper<
//!     A, R,
//!     F: Fn(A) -> R,
//!     const f: F, // <-- this `const`-generic is not yet allowed
//! >(arg: A) -> R {
//!     f(arg)
//! }
//! ```

use std::mem;

pub(super) const fn reify_to_extern_c_fn_hrt_bridge<
    R,
    F: Fn(super::BridgeConfig<'_>) -> R + Copy,
>(
    f: F,
) -> extern "C" fn(super::BridgeConfig<'_>) -> R {
    // FIXME(eddyb) describe the `F` type (e.g. via `type_name::<F>`) once panic
    // formatting becomes possible in `const fn`.
    const {
        assert!(size_of::<F>() == 0, "selfless_reify: closure must be zero-sized");
    }
    extern "C" fn wrapper<R, F: Fn(super::BridgeConfig<'_>) -> R + Copy>(
        bridge: super::BridgeConfig<'_>,
    ) -> R {
        let f = unsafe {
            // SAFETY: `F` satisfies all criteria for "out of thin air"
            // reconstructability (see module-level doc comment).
            mem::conjure_zst::<F>()
        };
        f(bridge)
    }
    let _f_proof = f;
    wrapper::<R, F>
}
