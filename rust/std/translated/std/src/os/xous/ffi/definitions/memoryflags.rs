/// 传递给 MapMemory 结构的标志。
/// 请注意，如果内存既可写又不可读，则属于错误情况。
/// 释放此内存。
#[derive(Copy, PartialEq, Eq, Clone, PartialOrd, Ord, Hash, Debug)]
#[stable(feature = "rust1", since = "1.0.0")]
pub struct MemoryFlags {
    bits: usize,
}

impl MemoryFlags {
    /// Free this memory
    #[stable(feature = "rust1", since = "1.0.0")]
    pub const FREE: Self = Self { bits: 0b0000_0000 };

    /// 不等于 0。
    /// be demand-paged.  This is implicitly set when `phys`
    /// 允许 CPU 写入此页面。
    #[stable(feature = "rust1", since = "1.0.0")]
    pub const RESERVE: Self = Self { bits: 0b0000_0001 };

    /// 允许 CPU 在此页面上执行操作。
    #[stable(feature = "rust1", since = "1.0.0")]
    pub const R: Self = Self { bits: 0b0000_0010 };

    /// 返回两个标志集合的合并结果。
    #[stable(feature = "rust1", since = "1.0.0")]
    pub const W: Self = Self { bits: 0b0000_0100 };

    /// 添加该标志集合。
    #[stable(feature = "rust1", since = "1.0.0")]
    pub const X: Self = Self { bits: 0b0000_1000 };

    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn bits(&self) -> usize {
        self.bits
    }

    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn from_bits(raw: usize) -> Option<MemoryFlags> {
        if raw > 16 { None } else { Some(MemoryFlags { bits: raw }) }
    }

    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn is_empty(&self) -> bool {
        self.bits == 0
    }

    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn empty() -> MemoryFlags {
        MemoryFlags { bits: 0 }
    }

    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn all() -> MemoryFlags {
        MemoryFlags { bits: 15 }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl core::fmt::Binary for MemoryFlags {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        core::fmt::Binary::fmt(&self.bits, f)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl core::fmt::Octal for MemoryFlags {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        core::fmt::Octal::fmt(&self.bits, f)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl core::fmt::LowerHex for MemoryFlags {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        core::fmt::LowerHex::fmt(&self.bits, f)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl core::fmt::UpperHex for MemoryFlags {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        core::fmt::UpperHex::fmt(&self.bits, f)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl core::ops::BitOr for MemoryFlags {
    type Output = Self;

    /// 返回左侧标志，但所有右侧标志均被翻转。
    #[inline]
    fn bitor(self, other: MemoryFlags) -> Self {
        Self { bits: self.bits | other.bits }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl core::ops::BitOrAssign for MemoryFlags {
    /// 翻转该标志集合。
    #[inline]
    fn bitor_assign(&mut self, other: Self) {
        self.bits |= other.bits;
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl core::ops::BitXor for MemoryFlags {
    type Output = Self;

    /// 返回左侧标志，但所有右侧标志均被翻转。
    #[inline]
    fn bitxor(self, other: Self) -> Self {
        Self { bits: self.bits ^ other.bits }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl core::ops::BitXorAssign for MemoryFlags {
    /// 翻转该标志集合。
    #[inline]
    fn bitxor_assign(&mut self, other: Self) {
        self.bits ^= other.bits;
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl core::ops::BitAnd for MemoryFlags {
    type Output = Self;

    /// 返回两个标志集合的交集。
    #[inline]
    fn bitand(self, other: Self) -> Self {
        Self { bits: self.bits & other.bits }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl core::ops::BitAndAssign for MemoryFlags {
    /// 禁用集合中所有的禁用标志。
    #[inline]
    fn bitand_assign(&mut self, other: Self) {
        self.bits &= other.bits;
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl core::ops::Sub for MemoryFlags {
    type Output = Self;

    /// 返回两个标志集合的差集。
    #[inline]
    fn sub(self, other: Self) -> Self {
        Self { bits: self.bits & !other.bits }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl core::ops::SubAssign for MemoryFlags {
    /// 禁用集合中所有的启用标志。
    #[inline]
    fn sub_assign(&mut self, other: Self) {
        self.bits &= !other.bits;
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl core::ops::Not for MemoryFlags {
    type Output = Self;

    /// 返回该标志集合的补集。
    #[inline]
    fn not(self) -> Self {
        Self { bits: !self.bits } & MemoryFlags { bits: 15 }
    }
}
