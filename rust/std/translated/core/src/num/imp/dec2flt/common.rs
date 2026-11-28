//! 仅用于内部使用的通用工具函数。

/// 用于处理不可变字节的辅助方法。
pub(crate) trait ByteSlice {
    /// 以小端序将 8 个字节读取为 64 位整数。
    fn read_u64(&self) -> u64;

    /// 以小端序将 64 位整数写入 8 个字节。
    fn write_u64(&mut self, value: u64);

    /// 计算两个切片长度的差值。
    fn offset_from(&self, other: &Self) -> isize;

    /// 迭代地解析并消耗字节中的数字。
    ///
    /// 返回相同的字节，但已消耗的数字被省略。遇到无效的数字时会中断。
    fn parse_digits(&self, func: impl FnMut(u8)) -> &Self;
}

impl ByteSlice for [u8] {
    #[inline(always)] // inlining this is crucial to remove bound checks
    fn read_u64(&self) -> u64 {
        let mut tmp = [0; 8];
        tmp.copy_from_slice(&self[..8]);
        u64::from_le_bytes(tmp)
    }

    #[inline(always)] // inlining this is crucial to remove bound checks
    fn write_u64(&mut self, value: u64) {
        self[..8].copy_from_slice(&value.to_le_bytes())
    }

    #[inline]
    fn offset_from(&self, other: &Self) -> isize {
        other.len() as isize - self.len() as isize
    }

    #[inline]
    fn parse_digits(&self, mut func: impl FnMut(u8)) -> &Self {
        let mut s = self;

        while let Some((c, rest)) = s.split_first() {
            let c = c.wrapping_sub(b'0');
            if c < 10 {
                func(c);
                s = rest;
            } else {
                break;
            }
        }

        s
    }
}

/// Determine if all characters in an 8-byte byte string (represented as a `u64`) are all decimal
/// 数字。
///
/// 此函数不关心字节的加载顺序。
pub(crate) fn is_8digits(v: u64) -> bool {
    let a = v.wrapping_add(0x4646_4646_4646_4646);
    let b = v.wrapping_sub(0x3030_3030_3030_3030);
    (a | b) & 0x8080_8080_8080_8080 == 0
}

/// A custom 64-bit floating point type, representing `m * 2^p`.
/// p 具有偏置特性，因此可以直接移入指数位。
#[derive(Debug, Copy, Clone, PartialEq, Eq, Default)]
pub struct BiasedFp {
    /// 重要的数字位。
    pub m: u64,
    /// 具有偏置特性的二进制指数。
    pub p_biased: i32,
}

impl BiasedFp {
    /// Represent `0 ^ p`
    #[inline]
    pub const fn zero_pow2(p_biased: i32) -> Self {
        Self { m: 0, p_biased }
    }
}
