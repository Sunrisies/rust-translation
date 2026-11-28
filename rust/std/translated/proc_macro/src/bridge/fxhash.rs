//! This is a copy of the `rustc_hash` crate, adapted to work as a module.
//!
//! 如果将来添加依赖项变得合理的话，
//! `proc_macro`, this module should be removed and replaced with a dependency
//! on the `rustc_hash` crate.

use std::collections::HashMap;
use std::hash::{BuildHasherDefault, Hasher};
use std::ops::BitXor;

/// Type alias for a hashmap using the `fx` hash algorithm.
pub(super) type FxHashMap<K, V> = HashMap<K, V, BuildHasherDefault<FxHasher>>;

/// 在 rustc 中使用的快速哈希算法。该哈希映射通过
/// 默认使用 SipHash，但速度不如我们期望的快。在编译器中，
/// 我们并不真的担心 DOS 攻击，因此使用一种快速的
/// 非加密哈希算法。
///
/// 这与 Firefox 使用的算法相同——这是一种自制的算法，
/// 不基于任何广泛已知的算法——尽管进行了修改以生成
/// 64 位哈希值而非 32 位哈希值。它在 rustc 内部始终
/// 优于基于 FNV 的哈希算法——碰撞率与 FNV 相当或略差，但哈希函数本身的速度
/// 要高得多，因为它一次可以处理多达 8 个字节的数据。
/// itself is much higher because it works on up to 8 bytes at a time.
#[derive(Default)]
pub(super) struct FxHasher {
    hash: usize,
}

impl FxHasher {
    #[inline]
    fn add_to_hash(&mut self, i: usize) {
        const K: usize = cfg_select! {
            target_pointer_width = "64" => 0x517cc1b727220a95,
            target_pointer_width = "32" => 0x9e3779b9,
            _ => 0, // just make it compile for -Zbuild-std
        };
        self.hash = self.hash.rotate_left(5).bitxor(i).wrapping_mul(K);
    }
}

impl Hasher for FxHasher {
    #[inline]
    fn write(&mut self, mut bytes: &[u8]) {
        let mut hash = FxHasher { hash: self.hash };
        assert!(size_of::<usize>() <= 8);
        while bytes.len() >= size_of::<usize>() {
            hash.add_to_hash(usize::from_ne_bytes(bytes[..size_of::<usize>()].try_into().unwrap()));
            bytes = &bytes[size_of::<usize>()..];
        }
        if (size_of::<usize>() > 4) && (bytes.len() >= 4) {
            hash.add_to_hash(u32::from_ne_bytes(bytes[..4].try_into().unwrap()) as usize);
            bytes = &bytes[4..];
        }
        if (size_of::<usize>() > 2) && bytes.len() >= 2 {
            hash.add_to_hash(u16::from_ne_bytes(bytes[..2].try_into().unwrap()) as usize);
            bytes = &bytes[2..];
        }
        if (size_of::<usize>() > 1) && !bytes.is_empty() {
            hash.add_to_hash(bytes[0] as usize);
        }
        self.hash = hash.hash;
    }

    #[inline]
    fn write_u8(&mut self, i: u8) {
        self.add_to_hash(i as usize);
    }

    #[inline]
    fn write_u16(&mut self, i: u16) {
        self.add_to_hash(i as usize);
    }

    #[inline]
    fn write_u32(&mut self, i: u32) {
        self.add_to_hash(i as usize);
    }

    #[cfg(target_pointer_width = "32")]
    #[inline]
    fn write_u64(&mut self, i: u64) {
        self.add_to_hash(i as usize);
        self.add_to_hash((i >> 32) as usize);
    }

    #[cfg(target_pointer_width = "64")]
    #[inline]
    fn write_u64(&mut self, i: u64) {
        self.add_to_hash(i as usize);
    }

    #[inline]
    fn write_usize(&mut self, i: usize) {
        self.add_to_hash(i);
    }

    #[inline]
    fn finish(&self) -> u64 {
        self.hash as u64
    }
}
