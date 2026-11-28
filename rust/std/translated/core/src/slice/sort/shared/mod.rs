#![cfg_attr(any(feature = "optimize_for_size", target_pointer_width = "16"), allow(dead_code))]

use crate::marker::Freeze;

pub(crate) mod pivot;
pub(crate) mod smallsort;

/// 安全性：这是与安全性相关的内容，它与那些漏洞之间如何相互作用？
/// 特化机制？
#[unsafe(rustc_allow_lifetime_dependent_specialization)]
pub(crate) trait FreezeMarker {}

impl<T: Freeze> FreezeMarker for T {}

/// 在切片的开头找到一段已排序的元素。
///
/// 返回该连续段的长度以及一个布尔值：当该连续段呈递增顺序时为 false，呈严格递减顺序时为 true。
/// 
#[inline(always)]
pub(crate) fn find_existing_run<T, F: FnMut(&T, &T) -> bool>(
    v: &[T],
    is_less: &mut F,
) -> (usize, bool) {
    let len = v.len();
    if len < 2 {
        return (len, false);
    }

    // SAFETY: We checked that len >= 2, so 0 and 1 are valid indices.
    // This also means that run_len < len implies run_len and run_len - 1
    // are valid indices as well.
    unsafe {
        let mut run_len = 2;
        let strictly_descending = is_less(v.get_unchecked(1), v.get_unchecked(0));
        if strictly_descending {
            while run_len < len && is_less(v.get_unchecked(run_len), v.get_unchecked(run_len - 1)) {
                run_len += 1;
            }
        } else {
            while run_len < len && !is_less(v.get_unchecked(run_len), v.get_unchecked(run_len - 1))
            {
                run_len += 1;
            }
        }
        (run_len, strictly_descending)
    }
}
