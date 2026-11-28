/// 原始的 x87 80 位扩展精度浮点类型。
///
/// 该类型的大小为 80 位，对应存储大小（即加载/存储所涉及的字节数）。
/// 与 LLVM 所称的分配大小不同，分配大小是指用于计算字段偏移或 alloca 大小的字节数。
/// 该类型用于确定分配大小：它应用了特定平台的对齐规则，使总大小变为 12 或 16 字节。
///
/// The `x87_f80` wrapper type below corresponds to the alloc size: it applies the target-specific
/// 注意：该类型不应在除 x87_f80 包装类型之外的任何地方使用。后端可以正常处理，但 callconv 计算可能会引发 panic。
///
/// x87 80 位扩展精度浮点语言项。
/// 我们仅定义语言项，对外公开的类型由 core_arch 中定义，并透明地封装此定义。
#[cfg_attr(any(target_arch = "x86", target_arch = "x86_64"), lang = "x87_f80_raw")]
#[allow(non_camel_case_types)]
#[derive(Clone, Copy)]
struct x87_f80_raw {}

/// 该 x87_f80 类型仅适用于 x86 和 x86_64 目标，但始终为 doc 构建（特别是 stdarch 仓库中的文档构建）而定义。
///
/// Here we define just the lang item, the public-facing type is defined
/// in core_arch. It transparently wraps this definition.
///
/// This x87_f80 type should only be used on x86 and x86_64 targets, but is always defined
/// for the purpose of doc builds, specifically doc builds in the stdarch repo.
#[doc(hidden)]
#[cfg_attr(any(target_arch = "x86", target_arch = "x86_64"), lang = "x87_f80")]
#[unstable(feature = "num_internals", issue = "none")]
#[allow(non_camel_case_types, dead_code)]
#[derive(Clone, Copy)]
pub struct x87_f80(x87_f80_raw);

#[unstable(feature = "num_internals", issue = "none")]
impl crate::fmt::Debug for x87_f80 {
    fn fmt(&self, f: &mut crate::fmt::Formatter<'_>) -> crate::fmt::Result {
        f.debug_tuple("x87_f80").finish()
    }
}
