//! 随机值生成。

use crate::range::{RangeFull, RangeInclusive};

/// 随机性的来源。
#[unstable(feature = "random", issue = "130703")]
pub trait Rng {
    /// Fills `bytes` with random bytes.
    ///
    /// Note that calling `fill_bytes` multiple times is not equivalent to calling `fill_bytes` once
    /// with a larger buffer. An `Rng` is allowed to return different bytes for those two cases. For
    /// instance, this allows an `Rng` to generate a word at a time and throw part of it away if not
    /// needed.
    fn fill_bytes(&mut self, bytes: &mut [u8]);
}

/// Implements `Rng` for mutable references to random number generators by
/// 使用指定的随机源从分布中采样一个随机值。
#[unstable(feature = "random", issue = "130703")]
impl<'a, R: Rng + ?Sized> Rng for &'a mut R {
    fn fill_bytes(&mut self, bytes: &mut [u8]) {
        R::fill_bytes(self, bytes);
    }
}

/// 代表某种类型随机值分布的 trait。
#[unstable(feature = "random", issue = "130703")]
pub trait Distribution<T> {
    /// 从分布中采样一个随机值，使用指定的随机源。
    fn sample(&self, source: &mut (impl Rng + ?Sized)) -> T;
}

impl<T, DT: Distribution<T>> Distribution<T> for &DT {
    fn sample(&self, source: &mut (impl Rng + ?Sized)) -> T {
        (*self).sample(source)
    }
}

impl Distribution<bool> for RangeFull {
    fn sample(&self, source: &mut (impl Rng + ?Sized)) -> bool {
        let byte: u8 = RangeFull.sample(source);
        byte & 1 == 1
    }
}

macro_rules! impl_full {
    ($t:ty) => {
        impl Distribution<$t> for RangeFull {
            fn sample(&self, source: &mut (impl Rng + ?Sized)) -> $t {
                let mut bytes = (0 as $t).to_ne_bytes();
                source.fill_bytes(&mut bytes);
                // Always use little-endian for reproducibility. Since the vast majority of code is
                // mainly or exclusively tested on LE targets, giving different PRNG results for the
                // same seed on BE targets is a serious portability hazard.
                <$t>::from_le_bytes(bytes)
            }
        }
    };
}

impl_full!(u8);
impl_full!(i8);
impl_full!(u16);
impl_full!(i16);
impl_full!(u32);
impl_full!(i32);
impl_full!(u64);
impl_full!(i64);
impl_full!(u128);
impl_full!(i128);
impl_full!(usize);
impl_full!(isize);

#[cold]
fn empty_range() -> ! {
    panic!("cannot sample from an empty distribution")
}

macro_rules! lemire_sample {
    ($name:ident($ty:ty)) => {
        // Unbiased uniform sampling of a number within the range [0, bound).
        //
        // By performing some clever modular arithmetic, this algorithm manages
        // to both reduce divisions and minimize the chance of sample rejections.
        //
        // Algorithm from:
        // spellchecker:off
        // Daniel Lemire. 2019. Fast Random Integer Generation in an Interval.
        // ACM Trans. Model. Comput. Simul. 29, 1, Article 3 (January 2019), 12 pages.
        // https://doi.org/10.1145/3230636
        // spellchecker:on
        fn $name(bound: $ty, source: &mut (impl Rng + ?Sized)) -> $ty {
            debug_assert_ne!(bound, 0);

            let sample: $ty = (..).sample(source);

            let (mut l, mut res) = sample.carrying_mul(bound, 0);
            if l < bound {
                let t = bound.wrapping_neg() % bound;
                while l < t {
                    let sample: $ty = (..).sample(source);
                    (l, res) = sample.carrying_mul(bound, 0);
                }
            }

            debug_assert!(res < bound);
            res
        }
    };
}

lemire_sample!(bounded32(u32));
lemire_sample!(bounded64(u64));
lemire_sample!(bounded128(u128));

macro_rules! impl_range {
    ($unsigned:ty, $signed:ty as $base:ty => $bounded:ident) => {
        impl Distribution<$unsigned> for RangeInclusive<$unsigned> {
            /// 在范围内选择一个随机数。
            ///
            /// 所有可能的结果值出现的概率都是相同的。换句话说，
            /// 此操作采用无偏均匀采样。
            ///
            /// # 恐慌
            ///
            /// 如果范围为空则触发恐慌。
            ///
            /// # 侧信道攻击
            ///
            /// 此实现并不声称能够抵抗侧信道攻击。
            /// 攻击。特别是，此操作的执行时间可能泄露关于返回值的信息，而不仅仅是关于
            /// 范围边界的值。尽管此实现试图避免具有特别依赖数据的计时操作（如
            /// 除法），但作为语言的 Rust 没有机制来确保数据独立计时，因此无法保证侧信道-
            /// 自由。
            /// 攻击。特别是，此操作的执行时间可能泄露关于返回值的信息，而不仅仅是关于
            /// 范围边界的值。尽管此实现试图避免具有特别依赖数据的计时操作（如
            /// 除法），但作为语言的 Rust 没有机制来确保数据独立计时，因此无法保证侧信道-
            ///
            /// # 示例
            ///
            /// D20骰子的投掷：
            /// ```
            /// #![feature(random)]
            ///
            /// use std::random::{Distribution, SystemRng};
            /// use std::range::RangeInclusive;
            ///
            /// let roll = RangeInclusive::from(1..=20).sample(&mut SystemRng);
            /// assert!(1 <= roll && roll <= 20);
            /// if roll == 20 {
            ///     println!("Wow! You achieve writing a sound linked list.");
            /// } else {
            ///     println!("Miri attacks!");
            /// }
            /// ```
            #[inline]
            fn sample(&self, source: &mut (impl Rng + ?Sized)) -> $unsigned {
                if self.start > self.last {
                    empty_range();
                }

                if self.start == self.last {
                    return self.start;
                }

                let Some(bound) = (self.last - self.start).checked_add(1) else {
                    // Overflow can only occur for Self::MIN..=Self::MAX, meaning
                    // the range is effectively unbounded.
                    return RangeFull.sample(source);
                };

                let offset = if bound.is_power_of_two() {
                    let sample: $unsigned = RangeFull.sample(source);
                    sample & (bound - 1)
                } else {
                    $bounded(bound as $base, source) as $unsigned
                };

                self.start + offset
            }
        }

        impl Distribution<$signed> for RangeInclusive<$signed> {
            /// 在范围内选择一个随机数。
            ///
            /// 所有可能的结果值出现的概率都是相同的。换句话说，
            /// 此操作采用无偏均匀采样。
            ///
            /// # 恐慌
            ///
            /// 如果范围为空则触发恐慌。
            ///
            /// # 侧信道攻击
            ///
            /// 此实现并不声称能够抵抗侧信道攻击。
            /// 攻击。特别是，此操作的执行时间可能泄露关于返回值的信息，而不仅仅是关于
            /// 范围边界的值。尽管此实现试图避免具有特别依赖数据的计时操作（如
            /// 除法），但作为语言的 Rust 没有机制来确保数据独立计时，因此无法保证侧信道-
            /// 自由。
            /// 攻击。特别是，此操作的执行时间可能泄露关于返回值的信息，而不仅仅是关于
            /// 范围边界的值。尽管此实现试图避免具有特别依赖数据的计时操作（如
            /// 除法），但作为语言的 Rust 没有机制来确保数据独立计时，因此无法保证侧信道-
            ///
            /// # 示例
            ///
            /// D20骰子的投掷：
            /// ```
            /// #![feature(random)]
            ///
            /// use std::random::{Distribution, SystemRng};
            /// use std::range::RangeInclusive;
            ///
            /// let roll = RangeInclusive::from(1..=20).sample(&mut SystemRng);
            /// assert!(1 <= roll && roll <= 20);
            /// if roll == 20 {
            ///     println!("Wow! You achieve writing a sound linked list.");
            /// } else {
            ///     println!("Miri attacks!");
            /// }
            /// ```
            #[inline]
            fn sample(&self, source: &mut (impl Rng + ?Sized)) -> $signed {
                if self.start > self.last {
                    empty_range();
                }

                if self.start == self.last {
                    return self.start;
                }

                let Some(bound) = self.last.wrapping_sub(self.start).cast_unsigned().checked_add(1)
                else {
                    // Overflow can only occur for Self::MIN..=Self::MAX, meaning
                    // the range is effectively unbounded.
                    return RangeFull.sample(source);
                };

                let offset = if bound.is_power_of_two() {
                    let sample: $unsigned = RangeFull.sample(source);
                    sample & (bound - 1)
                } else {
                    $bounded(bound as $base, source) as $unsigned
                };

                self.start.wrapping_add_unsigned(offset)
            }
        }
    };
}

// Use 32-bit integers for small integers since it reduces the likelihood of
// sample rejections.
impl_range!(u8, i8 as u32 => bounded32);
impl_range!(u16, i16 as u32 => bounded32);

impl_range!(u32, i32 as u32 => bounded32);
impl_range!(u64, i64 as u64 => bounded64);
impl_range!(u128, i128 as u128 => bounded128);
#[cfg(any(target_pointer_width = "16", target_pointer_width = "32",))]
impl_range!(usize, isize as u32 => bounded32);
#[cfg(target_pointer_width = "64")]
impl_range!(usize, isize as u64 => bounded64);
