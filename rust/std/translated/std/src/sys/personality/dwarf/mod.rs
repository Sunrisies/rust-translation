//! 用于解析 DWARF 编码数据流的工具函数。
//! See <http://www.dwarfstd.org>,
//! DWARF-4 标准，第 7 节 - “数据表示”

// This module is used only by x86_64-pc-windows-gnu for now, but we
// are compiling it everywhere to avoid regressions.
#![allow(unused)]
#![forbid(unsafe_op_in_unsafe_fn)]

#[cfg(test)]
mod tests;

pub mod eh;

pub struct DwarfReader {
    pub ptr: *const u8,
}

impl DwarfReader {
    pub fn new(ptr: *const u8) -> DwarfReader {
        DwarfReader { ptr }
    }

    /// 读取类型 T，然后将指针移动相应量。
    ///
    /// DWARF 流是“打包”的，因此所有类型必须在对齐为 1 的情况下读取。
    pub unsafe fn read<T: Copy>(&mut self) -> T {
        unsafe {
            let result = self.ptr.cast::<T>().read_unaligned();
            self.ptr = self.ptr.byte_add(size_of::<T>());
            result
        }
    }

    /// ULEB128 和 SLEB128 编码定义在第 7.6 节 - “可变长度数据”中。
    pub unsafe fn read_uleb128(&mut self) -> u64 {
        let mut shift: usize = 0;
        let mut result: u64 = 0;
        let mut byte: u8;
        loop {
            byte = unsafe { self.read::<u8>() };
            result |= ((byte & 0x7F) as u64) << shift;
            shift += 7;
            if byte & 0x80 == 0 {
                break;
            }
        }
        result
    }

    pub unsafe fn read_sleb128(&mut self) -> i64 {
        let mut shift: u32 = 0;
        let mut result: u64 = 0;
        let mut byte: u8;
        loop {
            byte = unsafe { self.read::<u8>() };
            result |= ((byte & 0x7F) as u64) << shift;
            shift += 7;
            if byte & 0x80 == 0 {
                break;
            }
        }
        // sign-extend
        if shift < u64::BITS && (byte & 0x40) != 0 {
            result |= (!0 as u64) << shift;
        }
        result as i64
    }
}
