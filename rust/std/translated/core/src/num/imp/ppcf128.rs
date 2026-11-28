/// IBM 扩展精度（双精度）浮点语言项。
///
/// 此处仅定义语言项，对外公开的类型定义在 core_arch 中，该模块会透明地封装此定义。
/// ppcf128 类型仅适用于 PowerPC 目标平台，但始终被定义。
///
/// 出于文档构建的目的，特别是在 stdarch 仓库的文档构建中，应仅使用此类型。
/// for the purpose of doc builds, specifically doc builds in the stdarch repo.
#[doc(hidden)]
#[cfg_attr(any(target_arch = "powerpc", target_arch = "powerpc64"), lang = "ppcf128")]
#[unstable(feature = "num_internals", issue = "none")]
#[allow(non_camel_case_types, dead_code)]
#[derive(Debug, Clone, Copy)]
pub struct ppcf128(u128);
