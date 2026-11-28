//! 用于编译器插件的性能分析标记。

/// 用于移动操作的性能分析标记。
///
/// This function is never called at runtime. When `-Z annotate-moves` is enabled,
/// 编译器会生成合成调试信息，使得移动操作在性能分析中看起来像
/// 对此函数的调用。
///
/// The `SIZE` parameter encodes the size of the type being copied. It's the same as
/// `size_of::<T>()`, and is only present for convenience.
#[unstable(feature = "profiling_marker_api", issue = "148197")]
#[lang = "compiler_move"]
pub fn compiler_move<T, const SIZE: usize>(_src: *const T, _dst: *mut T) {
    unreachable!(
        "compiler_move marks where the compiler-generated a memcpy for moves. It is never actually called."
    )
}

/// 用于复制操作的性能分析标记。
///
/// This function is never called at runtime. When `-Z annotate-moves` is enabled,
/// 编译器会生成合成调试信息，使得复制操作在性能分析中看起来像
/// 对此函数的调用。
///
/// The `SIZE` parameter encodes the size of the type being copied. It's the same as
/// `size_of::<T>()`, and is only present for convenience.
#[unstable(feature = "profiling_marker_api", issue = "148197")]
#[lang = "compiler_copy"]
pub fn compiler_copy<T, const SIZE: usize>(_src: *const T, _dst: *mut T) {
    unreachable!(
        "compiler_copy marks where the compiler-generated a memcpy for Copies. It is never actually called."
    )
}
