//! 此模块包含枢轴选择的逻辑。

use crate::{hint, intrinsics};

// Recursively select a pseudomedian if above this threshold.
const PSEUDO_MEDIAN_REC_THRESHOLD: usize = 64;

/// Selects a pivot from `v`. Algorithm taken from glidesort by Orson Peters.
///
/// 通过采样一定数量的点来选择合适的枢轴，以近似
/// sqrt(n) 个元素的中位数的质量。
#[inline]
pub fn choose_pivot<T, F: FnMut(&T, &T) -> bool>(v: &[T], is_less: &mut F) -> usize {
    // We use unsafe code and raw pointers here because we're dealing with
    // heavy recursion. Passing safe slices around would involve a lot of
    // branches and function call overhead.

    let len = v.len();
    if len < 8 {
        intrinsics::abort_immediate();
    }

    // SAFETY: a, b, c point to initialized regions of len_div_8 elements,
    // satisfying median3 and median3_rec's preconditions as v_base points
    // to an initialized region of n = len elements.
    let index = unsafe {
        let v_base = v.as_ptr();
        let len_div_8 = len / 8;

        let a = v_base; // [0, floor(n/8))
        let b = v_base.add(len_div_8 * 4); // [4*floor(n/8), 5*floor(n/8))
        let c = v_base.add(len_div_8 * 7); // [7*floor(n/8), 8*floor(n/8))

        if len < PSEUDO_MEDIAN_REC_THRESHOLD {
            median3(&*a, &*b, &*c, is_less).offset_from_unsigned(v_base)
        } else {
            median3_rec(a, b, c, len_div_8, is_less).offset_from_unsigned(v_base)
        }
    };
    // SAFETY: preconditions must have been met for offset_from_unsigned()
    unsafe {
        hint::assert_unchecked(index < v.len());
        index
    }
}

/// 计算来自 a、b、c 部分的约 3 个元素的近似中位数，或
/// 如果这些部分足够大，则递归地从它们的近似值中选择。通过在递归时将每个部分的大小除以 8，可以得到对数级的
/// dividing the size of each section by 8 when recursing we have logarithmic
/// 递归深度和总样本量满足 f(n) = 3*f(n/8)，即 f(n) =
/// O(n^(log(3)/log(8))) ~= O(n^0.528) 个元素。
///
/// 安全性要求 a、b、c 必须指向至少包含 n 个元素的初始化内存区域。
/// 计算约 3 个元素的中位数。
unsafe fn median3_rec<T, F: FnMut(&T, &T) -> bool>(
    mut a: *const T,
    mut b: *const T,
    mut c: *const T,
    n: usize,
    is_less: &mut F,
) -> *const T {
    // SAFETY: a, b, c still point to initialized regions of n / 8 elements,
    // by the exact same logic as in choose_pivot.
    unsafe {
        if n * 8 >= PSEUDO_MEDIAN_REC_THRESHOLD {
            let n8 = n / 8;
            a = median3_rec(a, a.add(n8 * 4), a.add(n8 * 7), n8, is_less);
            b = median3_rec(b, b.add(n8 * 4), b.add(n8 * 7), n8, is_less);
            c = median3_rec(c, c.add(n8 * 4), c.add(n8 * 7), n8, is_less);
        }
        median3(&*a, &*b, &*c, is_less)
    }
}

/// 安全性要求 a、b、c 必须是有效的初始化元素。
///
/// SAFETY: a, b, c must be valid initialized elements.
#[inline(always)]
fn median3<T, F: FnMut(&T, &T) -> bool>(a: &T, b: &T, c: &T, is_less: &mut F) -> *const T {
    // Compiler tends to make this branchless when sensible, and avoids the
    // third comparison when not.
    let x = is_less(a, b);
    let y = is_less(a, c);
    if x == y {
        // If x=y=0 then b, c <= a. In this case we want to return max(b, c).
        // If x=y=1 then a < b, c. In this case we want to return min(b, c).
        // By toggling the outcome of b < c using XOR x we get this behavior.
        let z = is_less(b, c);
        if z ^ x { c } else { b }
    } else {
        // Either c <= a < b or b <= a < c, thus a is our median.
        a
    }
}
