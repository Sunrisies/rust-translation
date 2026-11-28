//! SIMD 编译器内建功能。
//!
//! In this module, a "vector" is any `repr(simd)` type.

pub mod scalable;

use crate::marker::ConstParamTy;

/// 向向量中插入一个元素，并返回更新后的向量。
///
/// `T` must be a vector with element type `U`, and `idx` must be `const`.
///
/// # 安全性
///
/// `idx` must be in-bounds of the vector.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_insert<T, U>(x: T, idx: u32, val: U) -> T;

/// 从向量中提取一个元素。
///
/// `T` must be a vector with element type `U`, and `idx` must be `const`.
///
/// # 安全性
///
/// `idx` must be const and in-bounds of the vector.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_extract<T, U>(x: T, idx: u32) -> U;

/// 向向量中插入一个元素，并返回更新后的向量。
///
/// `T` must be a vector with element type `U`.
///
/// If the index is `const`, [`simd_insert`] may emit better assembly.
///
/// # 安全性
///
/// `idx` must be in-bounds of the vector.
#[rustc_nounwind]
#[rustc_intrinsic]
pub const unsafe fn simd_insert_dyn<T, U>(x: T, idx: u32, val: U) -> T;

/// 从向量中提取一个元素。
///
/// `T` must be a vector with element type `U`.
///
/// If the index is `const`, [`simd_extract`] may emit better assembly.
///
/// # 安全性
///
/// `idx` must be in-bounds of the vector.
#[rustc_nounwind]
#[rustc_intrinsic]
pub const unsafe fn simd_extract_dyn<T, U>(x: T, idx: u32) -> U;

/// 创建一个每个通道都包含提供值的向量。
///
/// `T` must be a vector with element type `U`.
#[rustc_nounwind]
#[rustc_intrinsic]
pub const unsafe fn simd_splat<T, U>(value: U) -> T;

/// 对两个 SIMD 向量进行逐元素相加。
///
/// `T` must be a vector of integers or floats.
/// 对于整数，使用包装算术运算。
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_add<T>(x: T, y: T) -> T;

/// Subtracts `rhs` from `lhs` elementwise.
///
/// `T` must be a vector of integers or floats.
/// 对于整数，使用包装算术运算。
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_sub<T>(lhs: T, rhs: T) -> T;

/// 逐元素对两个 SIMD 向量进行相乘。
///
/// `T` must be a vector of integers or floats.
/// 对于整数，使用包装算术运算。
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_mul<T>(x: T, y: T) -> T;

/// Divides `lhs` by `rhs` elementwise.
///
/// `T` must be a vector of integers or floats.
///
/// # 安全性
/// For integers, `rhs` must not contain any zero elements.
/// Additionally for signed integers, `<int>::MIN / -1` is undefined behavior.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_div<T>(lhs: T, rhs: T) -> T;

/// 逐元素返回两个向量的余数。
///
/// `T` must be a vector of integers or floats.
///
/// # 安全性
/// For integers, `rhs` must not contain any zero elements.
/// Additionally for signed integers, `<int>::MIN / -1` is undefined behavior.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_rem<T>(lhs: T, rhs: T) -> T;

/// 逐元素将向量左移，发生溢出时触发 UB。
///
/// Shifts `lhs` left by `rhs`, shifting in zeros.
///
/// `T` must be a vector of integers.
///
/// # 安全性
///
/// Each element of `rhs` must be in `0..<int>::BITS`.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_shl<T>(lhs: T, rhs: T) -> T;

/// 逐元素将向量右移，发生溢出时触发 UB。
///
/// `T` must be a vector of integers.
///
/// Shifts `lhs` right by `rhs`, shifting in sign bits for signed types.
///
/// # 安全性
///
/// Each element of `rhs` must be in `0..<int>::BITS`.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_shr<T>(lhs: T, rhs: T) -> T;

/// 对向量元素进行左移操作，发生溢出时会导致未定义行为。
///
/// Concatenates `a` and `b` elementwise (with `a` in the most significant half),
/// 生成一个长度相同的向量，但每个元素的大小是原来的两倍。
/// wide. Then shift this vector left elementwise by `shift`, shifting in zeros,
/// and extract the most significant half of each of the elements. If `a` and `b`
/// 则相当于对元素进行左旋转操作。
///
/// `T` must be a vector of integers.
///
/// # 安全性
///
/// Each element of `shift` must be in `0..<int>::BITS`.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_funnel_shl<T>(a: T, b: T, shift: T) -> T;

/// 对向量元素进行右移操作，发生溢出时会导致未定义行为。
///
/// Concatenates `a` and `b` elementwise (with `a` in the most significant half),
/// 生成一个长度相同的向量，但每个元素的大小是原来的两倍。
/// wide. Then shift this vector right elementwise by `shift`, shifting in zeros,
/// and extract the least significant half of each of the elements. If `a` and `b`
/// 则相当于对元素进行右旋转操作。
///
/// `T` must be a vector of integers.
///
/// # 安全性
///
/// Each element of `shift` must be in `0..<int>::BITS`.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_funnel_shr<T>(a: T, b: T, shift: T) -> T;

/// 计算无进位乘积。
///
/// 这类似于长乘法，但会丢弃进位。
///
/// This operation can be used to model multiplication in `GF(2)[X]`, the polynomial
/// ring over `GF(2)`.
///
/// `T` must be a vector of integers.
#[rustc_intrinsic]
#[rustc_nounwind]
pub unsafe fn simd_carryless_mul<T>(a: T, b: T) -> T;

/// 对向量元素进行“与”操作。
///
/// `T` must be a vector of integers.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_and<T>(x: T, y: T) -> T;

/// 对向量元素进行“或”操作。
///
/// `T` must be a vector of integers.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_or<T>(x: T, y: T) -> T;

/// 对向量元素进行“异或”操作。
///
/// `T` must be a vector of integers.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_xor<T>(x: T, y: T) -> T;

/// 对向量进行数值类型转换，按元素处理。
///
/// `T` and `U` must be vectors of integers or floats, and must have the same length.
///
/// 当将浮点数转换为整数时，结果会被截断。超出边界的结果会导致未定义行为。
/// 当将整数转换为浮点数时，结果会被四舍五入。
/// 否则，会截断或扩展数值，对于有符号整数，符号保持不变。
///
/// # 安全性
/// 从整数类型转换总是安全的。
/// 在两种浮点数类型之间的转换也总是安全的。
///
/// Casting floats to integers truncates, following the same rules as `to_int_unchecked`.
/// 具体来说，每个元素必须：
/// * Not be `NaN`
/// * 不是无限大的
/// * 能够在返回类型中表示，并去除其小数部分
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_cast<T, U>(x: T) -> U;

/// 进行数值类型的向量转换，按元素进行。
///
/// `T` and `U` be a vectors of integers or floats, and must have the same length.
///
/// Like `simd_cast`, but saturates float-to-integer conversions (NaN becomes 0).
/// This matches regular `as` and is always safe.
///
/// 当将浮点数转换为整数时，结果会被截断。
/// 当将整数转换为浮点数时，结果会被四舍五入。
/// 否则，会截断或扩展数值，对于有符号整数则保持符号不变。
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_as<T, U>(x: T) -> U;

/// 对向量中的每个元素进行取负操作。
///
/// `T` must be a vector of integers or floats.
/// 对于整数，使用循环算术运算。
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_neg<T>(x: T) -> T;

/// 按元素返回向量的绝对值。
///
/// `T` must be a vector of floating-point primitive types.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_fabs<T>(x: T) -> T;

/// 按元素返回两个向量中的最小值。
///
/// `T` must be a vector of floating-point primitive types.
///
/// 其行为类似于 IEEE 754-2019 中的 minimumNumber，*不同之处在于它不确定性地排列有符号的零。
/// 对于每个向量通道，零都是确定性的。特别是：
/// 如果其中一个参数为 NaN（静默或信号状态），则返回另一个参数。如果
/// both arguments are NaN, returns NaN. If the inputs compare equal (such as for the case of `+0.0`
/// and `-0.0`), either input may be returned non-deterministically.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_minimum_number_nsz<T>(x: T, y: T) -> T;

/// 按元素返回两个向量中的最大值。
///
/// `T` must be a vector of floating-point primitive types.
///
/// 其行为类似于 IEEE 754-2019 中的 maximumNumber，*不同之处在于它不确定性地排列有符号的零。特别是：
/// 对于每个向量通道，零都是确定性的。特别是：
/// 如果其中一个参数为 NaN（静默或信号状态），则返回另一个参数。如果
/// both arguments are NaN, returns NaN. If the inputs compare equal (such as for the case of `+0.0`
/// and `-0.0`), either input may be returned non-deterministically.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_maximum_number_nsz<T>(x: T, y: T) -> T;

/// 按元素测试两个向量是否相等。
///
/// `T` must be a vector of integers or floats.
///
/// `U` must be a vector of integers with the same number of elements and element size as `T`.
///
/// Returns `0` for false and `!0` for true.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_eq<T, U>(x: T, y: T) -> U;

/// 按元素测试两个向量是否不相等。
///
/// `T` must be a vector of integers or floats.
///
/// `U` must be a vector of integers with the same number of elements and element size as `T`.
///
/// Returns `0` for false and `!0` for true.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_ne<T, U>(x: T, y: T) -> U;

/// Tests if `x` is less than `y`, elementwise.
///
/// `T` must be a vector of integers or floats.
///
/// `U` must be a vector of integers with the same number of elements and element size as `T`.
///
/// Returns `0` for false and `!0` for true.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_lt<T, U>(x: T, y: T) -> U;

/// Tests if `x` is less than or equal to `y`, elementwise.
///
/// `T` must be a vector of integers or floats.
///
/// `U` must be a vector of integers with the same number of elements and element size as `T`.
///
/// Returns `0` for false and `!0` for true.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_le<T, U>(x: T, y: T) -> U;

/// Tests if `x` is greater than `y`, elementwise.
///
/// `T` must be a vector of integers or floats.
///
/// `U` must be a vector of integers with the same number of elements and element size as `T`.
///
/// Returns `0` for false and `!0` for true.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_gt<T, U>(x: T, y: T) -> U;

/// Tests if `x` is greater than or equal to `y`, elementwise.
///
/// `T` must be a vector of integers or floats.
///
/// `U` must be a vector of integers with the same number of elements and element size as `T`.
///
/// Returns `0` for false and `!0` for true.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_ge<T, U>(x: T, y: T) -> U;

/// 通过常量索引对两个向量进行洗牌。
///
/// `T` must be a vector.
///
/// `U` must be a **const** vector of `u32`s. This means it must either refer to a named
/// const or be given as an inline const expression (`const { ... }`).
///
/// `V` must be a vector with the same element type as `T` and the same length as `U`.
///
/// Returns a new vector such that element `i` is selected from `xy[idx[i]]`, where `xy`
/// is the concatenation of `x` and `y`. It is a compile-time error if `idx[i]` is out-of-bounds
/// of `xy`.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_shuffle<T, U, V>(x: T, y: T, idx: U) -> V;

/// 读取一个指针向量。
///
/// `T` must be a vector.
///
/// `U` must be a vector of pointers to the element type of `T`, with the same length as `T`.
///
/// `V` must be a vector of integers with the same length as `T` (but any element size).
///
/// For each pointer in `ptr`, if the corresponding value in `mask` is `!0`, read the pointer.
/// Otherwise if the corresponding value in `mask` is `0`, return the corresponding value from
/// `val`.
///
/// # 安全性
/// Each pointer in `ptr` whose corresponding value in `mask` is `!0` must be readable as if by
/// [`ptr::read`][crate::ptr::read] (e.g. aligned to the element type).
///
/// `mask` must only contain `0` or `!0` values.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_gather<T, U, V>(val: T, ptr: U, mask: V) -> T;

/// 向指针向量写入数据。
///
/// `T` must be a vector.
///
/// `U` must be a vector of pointers to the element type of `T`, with the same length as `T`.
///
/// `V` must be a vector of integers with the same length as `T` (but any element size).
///
/// For each pointer in `ptr`, if the corresponding value in `mask` is `!0`, write the
/// corresponding value in `val` to the pointer.
/// Otherwise if the corresponding value in `mask` is `0`, do nothing.
///
/// （当两次存储重叠时适用）
/// （此规则在两次存储重叠的情况下相关）
///
/// # 安全性
/// Each pointer in `ptr` whose corresponding value in `mask` is `!0` must be writable as if by
/// [`ptr::write`][crate::ptr::write] (e.g. aligned to the element type).
///
/// `mask` must only contain `0` or `!0` values.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_scatter<T, U, V>(val: T, ptr: U, mask: V);

/// 用于 SIMD masked load/store 内联方法的对齐选项类型。
#[derive(Debug, ConstParamTy, PartialEq, Eq)]
pub enum SimdAlign {
    // These values must match the compiler's `SimdAlign` defined in
    // `rustc_middle/src/ty/consts/int.rs`!
    /// 指针没有对齐要求。
    Unaligned = 0,
    /// 指针必须对齐到 SIMD 向量的元素类型。
    Element = 1,
    /// 指针必须对齐到 SIMD 向量类型。
    Vector = 2,
}

/// 读取一个指针向量。
///
/// `T` must be a vector.
///
/// `U` must be a pointer to the element type of `T`
///
/// `V` must be a vector of integers with the same length as `T` (but any element size).
///
/// For each element, if the corresponding value in `mask` is `!0`, read the corresponding
/// pointer offset from `ptr`.
/// The first element is loaded from `ptr`, the second from `ptr.wrapping_offset(1)` and so on.
/// Otherwise if the corresponding value in `mask` is `0`, return the corresponding value from
/// `val`.
///
/// # 安全性
/// `ptr` must be aligned according to the `ALIGN` parameter, see [`SimdAlign`] for details.
///
/// Each pointer offset from `ptr` whose corresponding value in `mask` is `!0` must be readable as if
/// by [`ptr::read`][crate::ptr::read].
///
/// `mask` must only contain `0` or `!0` values.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_masked_load<V, U, T, const ALIGN: SimdAlign>(mask: V, ptr: U, val: T)
-> T;

/// 向指针向量写入数据。
///
/// `T` must be a vector.
///
/// `U` must be a pointer to the element type of `T`
///
/// `V` must be a vector of integers with the same length as `T` (but any element size).
///
/// For each element, if the corresponding value in `mask` is `!0`, write the corresponding
/// value in `val` to the pointer offset from `ptr`.
/// The first element is written to `ptr`, the second to `ptr.wrapping_offset(1)` and so on.
/// Otherwise if the corresponding value in `mask` is `0`, do nothing.
///
/// # 安全性
/// `ptr` must be aligned according to the `ALIGN` parameter, see [`SimdAlign`] for details.
///
/// Each pointer offset from `ptr` whose corresponding value in `mask` is `!0` must be writable as if
/// by [`ptr::write`][crate::ptr::write].
///
/// `mask` must only contain `0` or `!0` values.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_masked_store<V, U, T, const ALIGN: SimdAlign>(mask: V, ptr: U, val: T);

/// 对两个 simd 向量进行元素wise 加法，并采用饱和操作。
///
/// `T` must be a vector of integer primitive types.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_saturating_add<T>(x: T, y: T) -> T;

/// 对两个 simd 向量进行元素wise 减法，并采用饱和操作。
///
/// `T` must be a vector of integer primitive types.
///
/// Subtract `rhs` from `lhs`.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_saturating_sub<T>(lhs: T, rhs: T) -> T;

/// 在向量内从左到右依次添加元素。
///
/// `T` must be a vector of integers or floats.
///
/// `U` must be the element type of `T`.
///
/// Starting with the value `y`, add the elements of `x` and accumulate.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_reduce_add_ordered<T, U>(x: T, y: U) -> U;

/// 在向量内以任意顺序添加元素。也可以重新关联为
/// 输入/输出上的无序添加操作。
///
/// `T` must be a vector of integers or floats.
///
/// `U` must be the element type of `T`.
#[rustc_intrinsic]
#[rustc_nounwind]
pub unsafe fn simd_reduce_add_unordered<T, U>(x: T) -> U;

/// 从左到右对向量内的元素进行乘法操作。
///
/// `T` must be a vector of integers or floats.
///
/// `U` must be the element type of `T`.
///
/// Starting with the value `y`, multiply the elements of `x` and accumulate.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_reduce_mul_ordered<T, U>(x: T, y: U) -> U;

/// 在向量内以任意顺序进行乘法操作。也可以重新关联为
/// 输入/输出上的无序添加操作。
///
/// `T` must be a vector of integers or floats.
///
/// `U` must be the element type of `T`.
#[rustc_intrinsic]
#[rustc_nounwind]
pub unsafe fn simd_reduce_mul_unordered<T, U>(x: T) -> U;

/// 检查所有掩码值是否均为 true。
///
/// `T` must be a vector of integers.
///
/// # 安全性
/// `x` must contain only `0` or `!0`.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_reduce_all<T>(x: T) -> bool;

/// 检查是否有任何掩码值为 true。
///
/// `T` must be a vector of integers.
///
/// # 安全性
/// `x` must contain only `0` or `!0`.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_reduce_any<T>(x: T) -> bool;

/// 返回向量中的最大元素。
///
/// `T` must be a vector of integers.
///
/// `U` must be the element type of `T`.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_reduce_max<T, U>(x: T) -> U;

/// 返回向量中的最小元素。
///
/// `T` must be a vector of integers.
///
/// `U` must be the element type of `T`.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_reduce_min<T, U>(x: T) -> U;

/// 将所有元素一起进行逻辑“与”操作。
///
/// `T` must be a vector of integers.
///
/// `U` must be the element type of `T`.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_reduce_and<T, U>(x: T) -> U;

/// 将所有元素一起进行逻辑“或”操作。
///
/// `T` must be a vector of integers.
///
/// `U` must be the element type of `T`.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_reduce_or<T, U>(x: T) -> U;

/// 将所有元素一起进行逻辑“异或”操作。
///
/// `T` must be a vector of integers.
///
/// `U` must be the element type of `T`.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_reduce_xor<T, U>(x: T) -> U;

/// 将整数向量截断为位掩码。
///
/// `T` must be an integer vector.
///
/// `U` must be either the smallest unsigned integer with at least as many bits as the length
/// of `T`, or the smallest array of `u8` with at least as many bits as the length of `T`.
///
/// 无论输出是数组还是无符号整数，都被视为一个连续的位列表。位掩码总是被打包在输出的最低有效位上，并在最高有效位处填充 0。位的顺序取决于字节序：
///
/// * 在小端模式下，最低有效位对应第一个向量元素。 * 在大端模式下，最低有效位对应最后一个向量元素。
/// contiguous list of bits. The bitmask is always packed on the least-significant side of the
/// 为了考虑一个更大的示例，
/// endianness:
///
/// * On little endian, the least significant bit corresponds to the first vector element.
/// * On big endian, the least significant bit corresponds to the last vector element.
///
/// For example, `[!0, 0, !0, !0]` packs to
/// - `0b1101u8` or `[0b1101]` on little endian, and
/// - `0b1011u8` or `[0b1011]` on big endian.
///
/// 为了考虑一个更大的示例，
/// `[!0, 0, 0, 0, 0, 0, 0, 0, !0, !0, 0, 0, 0, 0, !0, 0]` packs to
/// - `0b0100001100000001u16` or `[0b00000001, 0b01000011]` on little endian, and
/// - `0b1000000011000010u16` or `[0b10000000, 0b11000010]` on big endian.
///
/// 最后，一个非 2 的幂次示例，包含多个字节：
/// `[!0, !0, 0, !0, 0, 0, !0, 0, !0, 0]` packs to
/// - `0b0101001011u16` or `[0b01001011, 0b01]` on little endian, and
/// - `0b1101001010u16` or `[0b11, 0b01001010]` on big endian.
///
/// # 安全性
/// `x` must contain only `0` and `!0`.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_bitmask<T, U>(x: T) -> U;

/// 从掩码中选择元素。
///
/// `T` must be a vector.
///
/// `M` must be an integer vector with the same length as `T` (but any element size).
///
/// For each element, if the corresponding value in `mask` is `!0`, select the element from
/// `if_true`.  If the corresponding value in `mask` is `0`, select the element from
/// `if_false`.
///
/// # 安全性
/// `mask` must only contain `0` and `!0`.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_select<M, T>(mask: M, if_true: T, if_false: T) -> T;

/// 从位掩码中选择元素。
///
/// `M` must be an unsigned integer or array of `u8`, matching `simd_bitmask`.
///
/// `T` must be a vector.
///
/// For each element, if the bit in `mask` is `1`, select the element from
/// `if_true`.  If the corresponding bit in `mask` is `0`, select the element from
/// `if_false`.
/// 掩码中的其余位被忽略。
///
/// The bitmask bit order matches `simd_bitmask`.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_select_bitmask<M, T>(m: M, yes: T, no: T) -> T;

/// 逐元素计算指针向量之间的偏移量，可能
/// 循环。
///
/// `T` must be a vector of pointers.
///
/// `U` must be a vector of `isize` or `usize` with the same number of elements as `T`.
///
/// Operates as if by `<ptr>::wrapping_offset`.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_arith_offset<T, U>(ptr: T, offset: U) -> T;

/// 将指针向量进行转换。
///
/// `T` and `U` must be vectors of pointers with the same number of elements.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_cast_ptr<T, U>(ptr: T) -> U;

/// 将指针向量表示为地址向量。
///
/// `T` must be a vector of pointers.
///
/// `U` must be a vector of `usize` with the same length as `T`.
#[rustc_intrinsic]
#[rustc_nounwind]
pub unsafe fn simd_expose_provenance<T, U>(ptr: T) -> U;

/// 从地址向量创建指针向量。
///
/// `T` must be a vector of `usize`.
///
/// `U` must be a vector of pointers, with the same length as `T`.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_with_exposed_provenance<T, U>(addr: T) -> U;

/// 交换每个元素的字节。
///
/// `T` must be a vector of integers.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_bswap<T>(x: T) -> T;

/// 反转每个元素的位。
///
/// `T` must be a vector of integers.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_bitreverse<T>(x: T) -> T;

/// 统计每个元素的前导零个数。
///
/// `T` must be a vector of integers.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_ctlz<T>(x: T) -> T;

/// 统计每个元素中的1的个数。
///
/// `T` must be a vector of integers.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_ctpop<T>(x: T) -> T;

/// 统计每个元素的尾随零个数。
///
/// `T` must be a vector of integers.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_cttz<T>(x: T) -> T;

/// 将每个元素向上舍入为下一个最高数值的浮点数。
///
/// `T` must be a vector of floats.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_ceil<T>(x: T) -> T;

/// 将每个元素向下舍入为下一个最低数值的浮点数。
///
/// `T` must be a vector of floats.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_floor<T>(x: T) -> T;

/// 将每个元素舍入为最近的数值整数浮点数。
/// 相等值通过远离0的舍入来解决。
///
/// `T` must be a vector of floats.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_round<T>(x: T) -> T;

/// 将每个元素舍入为最近的数值整数浮点数。
/// 相等值通过舍入到最右侧数字为偶数的情况来解决。
///
/// `T` must be a vector of floats.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_round_ties_even<T>(x: T) -> T;

/// 将每个元素的整数部分转换为数值整数浮点数。
/// 换句话说，非整数值向零方向截断。
///
/// `T` must be a vector of floats.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_trunc<T>(x: T) -> T;

/// 对每个元素求平方根。
///
/// `T` must be a vector of floats.
#[rustc_intrinsic]
#[rustc_nounwind]
pub unsafe fn simd_fsqrt<T>(x: T) -> T;

/// Computes `(x*y) + z` for each element, but without any intermediate rounding.
///
/// `T` must be a vector of floats.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_fma<T>(x: T, y: T, z: T) -> T;

/// Computes `(x*y) + z` for each element, non-deterministically executing either
/// 融合乘法加法或两次带有中间结果舍入的操作。
///
/// 如果代码生成器确定目标指令
/// 支持融合操作，并且该融合操作比等效的单独mul和add指令更高效
/// 则该操作被融合。具体是否选择融合操作取决于优化级别和上下文，甚至某些SIMD通道也可能被融合。
/// whether or not a fused operation is selected, and that may depend on optimization
/// level and context, for example. It may even be the case that some SIMD lanes get fused
/// 而其他则不是。
///
/// `T` must be a vector of floats.
#[rustc_intrinsic]
#[rustc_nounwind]
pub const unsafe fn simd_relaxed_fma<T>(x: T, y: T, z: T) -> T;

// Computes the sine of each element.
///
/// `T` must be a vector of floats.
#[rustc_intrinsic]
#[rustc_nounwind]
pub unsafe fn simd_fsin<T>(a: T) -> T;

// Computes the cosine of each element.
///
/// `T` must be a vector of floats.
#[rustc_intrinsic]
#[rustc_nounwind]
pub unsafe fn simd_fcos<T>(a: T) -> T;

// Computes the exponential function of each element.
///
/// `T` must be a vector of floats.
#[rustc_intrinsic]
#[rustc_nounwind]
pub unsafe fn simd_fexp<T>(a: T) -> T;

// Computes 2 raised to the power of each element.
///
/// `T` must be a vector of floats.
#[rustc_intrinsic]
#[rustc_nounwind]
pub unsafe fn simd_fexp2<T>(a: T) -> T;

// Computes the base 10 logarithm of each element.
///
/// `T` must be a vector of floats.
#[rustc_intrinsic]
#[rustc_nounwind]
pub unsafe fn simd_flog10<T>(a: T) -> T;

// Computes the base 2 logarithm of each element.
///
/// `T` must be a vector of floats.
#[rustc_intrinsic]
#[rustc_nounwind]
pub unsafe fn simd_flog2<T>(a: T) -> T;

// Computes the natural logarithm of each element.
///
/// `T` must be a vector of floats.
#[rustc_intrinsic]
#[rustc_nounwind]
pub unsafe fn simd_flog<T>(a: T) -> T;
