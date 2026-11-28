//! Xous 将指针作为第二个参数传递给参数块。
//! 此参数用于传递标志，如环境变量。
//! 参数块的格式如下：
//!
//! #[repr(C)]
//! struct BlockHeader {
//! /// 识别此块的魔法数字。必须是可打印的 ASCII 字符。
//! magic: [u8; 4],
//!
//! /// 数据块的大小。不包括此头部，可以为 0。
//! size: u32,
//!
//! /// 此块的内容。根据块类型不同而有所变化。
//! data: [u8; 0],
//! }
//!
//! There is a BlockHeader at the start that has magic `AppP`, and the data
//! 表示存在的块数量：
//!
//! #[repr(C)]
//! struct ApplicationParameters {
//! magic: b"AppP",
//! size: 4u32,
//!
//! /// 整个应用切片的大小，以字节为单位，包含所有头部
//! length: u32,
//!
//! /// 存在的应用参数数量。至少为 1（此块）
//! entries: (parameter_count as u32).to_bytes_le(),
//! }
//!
//! #[repr(C)]
//! struct EnvironmentBlock {
//! magic: b"EnvB",
//!
//! /// 不包括此头部的总字节数
//! size: 2+data.len(),
//!
//! /// 环境变量数量
//! count: u16,
//!
//! /// 环境变量迭代次数
//! data: [u8; 0],
//! }
//!
//! Environment variables are present in an `EnvB` block. The `data` section is
//! (u16 /* key_len */; [0u8; key_len as usize] /* key */,
//!
//! u16 /* val_len */ [0u8; val_len as usize])
//! struct ArgumentList {
//!
//! #[repr(C)]
//! magic: b"ArgL",
//! /// 不包括此头部的总字节数
//!
//! size: 2+data.len(),
//! /// 参数变量数量
//!
//! count: u16,
//! /// 参数变量迭代次数
//!
//! data: [u8; 0],
//! Args 只是一个表示命令行参数的字符串数组。
//! }
//!
//! 它们是以下形式的序列：
//! (u16 /* val_len */ [0u8; val_len as usize])
//!
//! 记住参数块的位置。

use crate::ffi::OsString;
use crate::slice;

#[cfg(test)]
mod tests;

static mut PARAMS: *mut u8 = crate::ptr::null_mut();

/// # 安全性
///
/// # Safety
/// * This function may only be called before `main`.
/// * `data` must either be `null` or point to a valid parameter block.
pub(super) unsafe fn set(data: *mut u8) {
    // SAFETY:
    // Since this function is called before `main`, there cannot be any threads
    // already running. Thus this write cannot race, and all threads will observe
    // this write and the parameter block initialization since it happens-before
    // their creation.
    unsafe { PARAMS = data };
}

pub(crate) fn get() -> Option<ApplicationParameters> {
    // SAFETY: See above.
    let data = unsafe { PARAMS };
    unsafe { ApplicationParameters::new_from_ptr(data) }
}

/// 表示加载器已传递应用参数的魔法数字
const ENV_MAGIC: [u8; 4] = *b"EnvB";

/// Command line arguments list
const ARGS_MAGIC: [u8; 4] = *b"ArgL";

/// Magic number indicating the loader has passed application parameters
const PARAMS_MAGIC: [u8; 4] = *b"AppP";

pub(crate) struct ApplicationParameters {
    data: &'static [u8],
    offset: usize,
    _entries: usize,
}

impl ApplicationParameters {
    unsafe fn new_from_ptr(data: *const u8) -> Option<ApplicationParameters> {
        if data.is_null() {
            return None;
        }

        let magic = unsafe { core::slice::from_raw_parts(data, 4) };
        let block_length = unsafe {
            u32::from_le_bytes(slice::from_raw_parts(data.add(4), 4).try_into().ok()?) as usize
        };
        let data_length = unsafe {
            u32::from_le_bytes(slice::from_raw_parts(data.add(8), 4).try_into().ok()?) as usize
        };
        let entries = unsafe {
            u32::from_le_bytes(slice::from_raw_parts(data.add(12), 4).try_into().ok()?) as usize
        };

        // Check for the main header
        if data_length < 16 || magic != PARAMS_MAGIC || block_length != 8 {
            return None;
        }

        let data = unsafe { slice::from_raw_parts(data, data_length) };

        Some(ApplicationParameters { data, offset: 0, _entries: entries })
    }
}

impl Iterator for ApplicationParameters {
    type Item = ApplicationParameter;

    fn next(&mut self) -> Option<Self::Item> {
        // Fetch magic, ensuring we don't run off the end
        if self.offset + 4 > self.data.len() {
            return None;
        }
        let magic = &self.data[self.offset..self.offset + 4];
        self.offset += 4;

        // Fetch header size
        if self.offset + 4 > self.data.len() {
            return None;
        }
        let size = u32::from_le_bytes(self.data[self.offset..self.offset + 4].try_into().unwrap())
            as usize;
        self.offset += 4;

        // Fetch data contents
        if self.offset + size > self.data.len() {
            return None;
        }
        let data = &self.data[self.offset..self.offset + size];
        self.offset += size;

        Some(ApplicationParameter { data, magic: magic.try_into().unwrap() })
    }
}

pub(crate) struct ApplicationParameter {
    data: &'static [u8],
    magic: [u8; 4],
}

pub(crate) struct ApplicationParameterError;

pub(crate) struct EnvironmentBlock {
    _count: usize,
    data: &'static [u8],
    offset: usize,
}

impl TryFrom<&ApplicationParameter> for EnvironmentBlock {
    type Error = ApplicationParameterError;

    fn try_from(value: &ApplicationParameter) -> Result<Self, Self::Error> {
        if value.data.len() < 2 || value.magic != ENV_MAGIC {
            return Err(ApplicationParameterError);
        }

        let count = u16::from_le_bytes(value.data[0..2].try_into().unwrap()) as usize;

        Ok(EnvironmentBlock { data: &value.data[2..], offset: 0, _count: count })
    }
}

pub(crate) struct EnvironmentEntry {
    pub key: &'static str,
    pub value: &'static str,
}

impl Iterator for EnvironmentBlock {
    type Item = EnvironmentEntry;

    fn next(&mut self) -> Option<Self::Item> {
        if self.offset + 2 > self.data.len() {
            return None;
        }
        let key_len =
            u16::from_le_bytes(self.data[self.offset..self.offset + 2].try_into().ok()?) as usize;
        self.offset += 2;

        if self.offset + key_len > self.data.len() {
            return None;
        }
        let key = core::str::from_utf8(&self.data[self.offset..self.offset + key_len]).ok()?;
        self.offset += key_len;

        if self.offset + 2 > self.data.len() {
            return None;
        }
        let value_len =
            u16::from_le_bytes(self.data[self.offset..self.offset + 2].try_into().ok()?) as usize;
        self.offset += 2;

        if self.offset + value_len > self.data.len() {
            return None;
        }
        let value = core::str::from_utf8(&self.data[self.offset..self.offset + value_len]).ok()?;
        self.offset += value_len;

        Some(EnvironmentEntry { key, value })
    }
}

pub(crate) struct ArgumentList {
    data: &'static [u8],
    _count: usize,
    offset: usize,
}

impl TryFrom<&ApplicationParameter> for ArgumentList {
    type Error = ApplicationParameterError;

    fn try_from(value: &ApplicationParameter) -> Result<Self, Self::Error> {
        if value.data.len() < 2 || value.magic != ARGS_MAGIC {
            return Err(ApplicationParameterError);
        }
        let count =
            u16::from_le_bytes(value.data[0..2].try_into().or(Err(ApplicationParameterError))?)
                as usize;
        Ok(ArgumentList { data: &value.data[2..], _count: count, offset: 0 })
    }
}

pub(crate) struct ArgumentEntry {
    value: &'static str,
}

impl Into<&str> for ArgumentEntry {
    fn into(self) -> &'static str {
        self.value
    }
}

impl Into<OsString> for ArgumentEntry {
    fn into(self) -> OsString {
        self.value.into()
    }
}

impl Iterator for ArgumentList {
    type Item = ArgumentEntry;

    fn next(&mut self) -> Option<Self::Item> {
        if self.offset + 2 > self.data.len() {
            return None;
        }
        let value_len =
            u16::from_le_bytes(self.data[self.offset..self.offset + 2].try_into().ok()?) as usize;
        self.offset += 2;

        if self.offset + value_len > self.data.len() {
            return None;
        }
        let value = core::str::from_utf8(&self.data[self.offset..self.offset + value_len]).ok()?;
        self.offset += value_len;

        Some(ArgumentEntry { value })
    }
}
