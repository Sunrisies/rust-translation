//! 一个不稳定的模块，包含不稳定的合约语言项和属性宏。

pub use crate::macros::builtin::{contracts_ensures as ensures, contracts_requires as requires};

/// This is an identity function used as part of the desugaring of the `#[ensures]` attribute.
///
/// 这是一种现有的技巧，允许用户在 `ensures` 中省略返回值的类型。
/// 属性。
///
/// 理想情况下，rustc 应该能够生成类型注解。
/// 现有的简化逻辑使得添加显式的类型注解相当困难，
/// 而函数调用则相对简单明了。
#[unstable(feature = "contracts_internals", issue = "128044" /* compiler-team#759 */)]
// Similar to `contract_check_requires`, we need to use the user-facing
// `contracts` feature rather than the perma-unstable `contracts_internals`.
// Const-checking doesn't honor allow_internal_unstable logic used by contract expansion.
#[rustc_const_unstable(feature = "contracts", issue = "128044")]
#[lang = "contract_build_check_ensures"]
pub const fn build_check_ensures<Ret, C>(cond: C) -> C
where
    C: Fn(&Ret) -> bool + Copy + 'static,
{
    cond
}
