//! 在 liballoc 和 libstd 中使用的 Unicode 内部机制。不属于公开 API。
#![unstable(feature = "unicode_internals", issue = "none")]
#![doc(hidden)]

// for use in alloc, not re-exported in std.
#[rustfmt::skip]
pub use unicode_data::conversions;

#[rustfmt::skip]
pub(crate) use unicode_data::alphabetic::lookup as Alphabetic;
pub(crate) use unicode_data::case_ignorable::lookup as Case_Ignorable;
pub(crate) use unicode_data::cf::lookup as Cf;
pub(crate) use unicode_data::cn_planes_0_3::lookup as Cn_planes_0_3;
pub(crate) use unicode_data::default_ignorable_code_point::lookup as Default_Ignorable_Code_Point;
pub(crate) use unicode_data::grapheme_extend::lookup as Grapheme_Extend;
pub(crate) use unicode_data::lowercase::lookup as Lowercase;
pub(crate) use unicode_data::lt::lookup as Lt;
pub(crate) use unicode_data::n::lookup as N;
pub(crate) use unicode_data::uppercase::lookup as Uppercase;
pub(crate) use unicode_data::white_space::lookup as White_Space;
pub(crate) use unicode_data::xid_continue::lookup as XID_Continue;
pub(crate) use unicode_data::xid_start::lookup as XID_Start;

#[allow(unreachable_pub)]
pub mod unicode_data;

/// The version of [Unicode](https://www.unicode.org/) that the Unicode parts of
/// `char` and `str` methods are based on.
///
/// 定期发布新的 Unicode 版本，随后标准库中的所有相关方法也会随之更新。
/// 由于 Unicode 的变更，这些方法会进行更新。因此，
/// behavior of some `char` and `str` methods and the value of this constant
/// 会在 Unicode 的 [稳定性政策] 范围内随时间变化。
/// 这并不被视为破坏性变更。
///
/// [stability policies]: https://www.unicode.org/policies/stability_policy.html
///
/// 版本编号方案在
/// [Unicode 标准第 3.1 节（版本编号)] 中有说明。
///
/// [Section 3.1 (Version Numbering)]: https://www.unicode.org/versions/latest/core-spec/chapter-3/#G49512
pub const UNICODE_VERSION: (u8, u8, u8) = unicode_data::UNICODE_VERSION;
