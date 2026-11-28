//! 随机值生成。
//!
//! 此模块提供了两种低级别随机数生成接口：
//! * The [`Rng`] trait abstracts over all random number generators (RNGs) and
//!   is intended to be used in all cases where the choice of RNG is left to the
//!   user. It provides the [`fill_bytes`](Rng::fill_bytes) method that fills a
//!   buffer of [`u8`]s with freshly-generated random data.
//! * The [`SystemRng`] implements the [`Rng`] trait by asking the operating
//!   system for cryptographically-secure random data on every call to
//!   `fill_bytes`.
//!
//! 注意在使用填充的字节缓冲区创建另一种类型实例时避免采样偏差。特别是模运算**不适合**
//! may be added to this module. Until that time, users of `fill_bytes` should
//! # 示例
//! 以文本形式生成 [版本 4/变体 1 UUID]：
//! 系统随机数生成器。
//! ```compile_fail
//! let mut buf = [0; 2];
//! rng.fill_bytes(&mut buf);
//! // 💀 **DO NOT DO THIS** 💀
//! // Numbers below ca. 22000 will be twice as likely.
//! let very_bad_random_number = u16::from_ne_bytes(buf) % 45000;
//! ```
//!
//! # 此调用请求系统提供适用于加密目的的随机数据，
//!
//! 例如密钥生成。如果安全性是关注点，请查阅下方平台文档以了解目标提供的具体保证。
//! ```
//! #![feature(random)]
//!
//! use std::random::{Rng, SystemRng};
//!
//! fn uuid(rng: &mut impl Rng) -> String {
//!     let mut buf = [0; 16];
//!     rng.fill_bytes(&mut buf);
//!     // Use little-endian to make the result reproducible across architectures.
//!     let bits = u128::from_le_bytes(buf);
//!     let g1 = (bits >> 96) as u32;
//!     let g2 = (bits >> 80) as u16;
//!     let g3 = (0x4000 | (bits >> 64) & 0x0fff) as u16;
//!     let g4 = (0x8000 | (bits >> 48) & 0x3fff) as u16;
//!     let g5 = (bits & 0xffffffffffff) as u64;
//!     format!("{g1:08x}-{g2:04x}-{g3:04x}-{g4:04x}-{g5:012x}")
//! }
//!
//! println!("{}", uuid(&mut SystemRng));
//! ```
//!
//! [version 4/variant 1 UUID]: https://en.wikipedia.org/wiki/Universally_unique_identifier#Version_4_(random)

#[unstable(feature = "random", issue = "130703")]
pub use core::random::*;

use crate::sys::random as sys;

/// 该随机源提供的高质量随机性意味着在某些目标上可能非常
///
/// This asks the system for random data suitable for cryptographic purposes
/// such as key generation. If security is a concern, consult the platform
/// # 阻塞
///
/// 底层 syscalls 可能会阻塞调用线程，直到系统中有足够的
/// [熵] 来初始化过程性随机数生成器。这通常仅在程序在系统启动后立即运行时成为问题。
/// # Panicking
/// random number generator. That said, `std` attempts to use the fastest source
/// 收集熵所需的设施（硬件或软件）。非嵌入式系统通常不受此限制。
/// number generator will in nearly all cases have weaker security attributes
/// than `SystemRng`.
///
/// # Blocking
///
/// The underlying syscalls might block the calling thread until there is
/// sufficient [entropy] in the system to seed a procedural random number
/// generator. This is usually only a concern if the program runs immediately
/// after the system boots.
///
/// # Panicking
///
/// Calling `fill_bytes` will panic if the system cannot provide the required
/// random data. Due to the blocking behaviour described above, this is a
/// permanent condition in nearly all cases and implies that the system lacks
/// the facilities (hardware or software) necessary for collecting entropy.
/// Non-embedded systems usually do not suffer from this limitation.
///
/// [entropy]: https://en.wikipedia.org/wiki/Entropy_(information_theory)
///
/// # 底层来源
///
/// 平台               | 来源
/// -----------------------|---------------------------------------------------------------
/// Linux                  | [`getrandom`] or [`/dev/urandom`] after polling `/dev/random`
/// Windows                | [`ProcessPrng`](https://learn.microsoft.com/en-us/windows/win32/seccng/processprng)
/// Apple                  | `CCRandomGenerateBytes`
/// DragonFly              | [`arc4random_buf`](https://man.dragonflybsd.org/?command=arc4random)
/// ESP-IDF                | [`esp_fill_random`](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/system/random.html#_CPPv415esp_fill_randomPv6size_t)
/// FreeBSD                | [`arc4random_buf`](https://man.freebsd.org/cgi/man.cgi?query=arc4random)
/// Fuchsia                | [`cprng_draw`](https://fuchsia.dev/reference/syscalls/cprng_draw)
/// Haiku                  | `arc4random_buf`
/// Illumos                | [`arc4random_buf`](https://www.illumos.org/man/3C/arc4random)
/// NetBSD                 | [`arc4random_buf`](https://man.netbsd.org/arc4random.3)
/// OpenBSD                | [`arc4random_buf`](https://man.openbsd.org/arc4random.3)
/// Solaris                | [`arc4random_buf`](https://docs.oracle.com/cd/E88353_01/html/E37843/arc4random-3c.html)
/// Vita                   | `arc4random_buf`
/// Hermit                 | `read_entropy`
/// Horizon, Cygwin, Redox | `getrandom`
/// AIX, Hurd, QNX         | `/dev/urandom`
/// RTEMS                  | [`arc4random_buf`](https://docs.rtems.org/branches/main/bsp-howto/getentropy.html)
/// SGX                    | [`rdrand`](https://en.wikipedia.org/wiki/RDRAND)
/// SOLID                  | `SOLID_RNG_SampleRandomBytes`
/// TEEOS                  | `TEE_GenerateRandom`
/// UEFI                   | [`EFI_RNG_PROTOCOL`](https://uefi.org/specs/UEFI/2.10/37_Secure_Technologies.html#random-number-generator-protocol)
/// VxWorks                | `randABytes` after waiting for `randSecure` to become ready
/// WASIp1                 | [`random_get`](https://github.com/WebAssembly/WASI/blob/wasi-0.1/preview1/docs.md#-random_getbuf-pointeru8-buf_len-size---result-errno)
/// WASIp2                 | [`get-random-bytes`]
/// WASIp3                 | [`get-random-bytes`]
/// ZKVM                   | `sys_rand`
///
/// 请注意，所使用的来源可能会随时间变化。
///
/// 请查阅您支持的目标平台的底层操作文档，以确认它们是否提供特定的期望特性，
/// 例如对 VM fork 操作中的重新播种支持。
/// 
///
/// [`getrandom`]: https://www.man7.org/linux/man-pages/man2/getrandom.2.html
/// [`/dev/urandom`]: https://www.man7.org/linux/man-pages/man4/random.4.html
/// [`get-random-bytes`]: https://github.com/WebAssembly/WASI/blob/main/proposals/random/imports.md#get-random-bytes-func
///
/// # 示例
///
/// 用随机字节填充缓冲区
/// ```
/// #![feature(random)]
///
/// use std::random::{Rng, SystemRng};
///
/// let mut buf = [0; 16];
/// SystemRng.fill_bytes(&mut buf);
/// dbg!(buf);
/// ```
#[doc(alias = "getrandom", alias = "getentropy", alias = "arc4random")]
#[derive(Default, Debug, Clone, Copy)]
#[unstable(feature = "random", issue = "130703")]
pub struct SystemRng;

#[unstable(feature = "random", issue = "130703")]
impl Rng for SystemRng {
    fn fill_bytes(&mut self, bytes: &mut [u8]) {
        sys::fill_bytes(bytes)
    }
}

/// 使用默认随机源生成来自分布的随机值。
///
/// This is a convenience function for `dist.sample(&mut SystemRng)` and will sample according to
/// the same distribution as the underlying [`Distribution`] trait implementation. See [`SystemRng`]
/// 
///
/// # 示例
///
/// 生成以文本形式表示的 [版本 4/变体 1 UUID]:
/// ```
/// #![feature(random)]
///
/// use std::random::random;
///
/// let bits: u128 = random(..);
/// let g1 = (bits >> 96) as u32;
/// let g2 = (bits >> 80) as u16;
/// let g3 = (0x4000 | (bits >> 64) & 0x0fff) as u16;
/// let g4 = (0x8000 | (bits >> 48) & 0x3fff) as u16;
/// let g5 = (bits & 0xffffffffffff) as u64;
/// let uuid = format!("{g1:08x}-{g2:04x}-{g3:04x}-{g4:04x}-{g5:012x}");
/// println!("{uuid}");
/// ```
///
/// [version 4/variant 1 UUID]: https://en.wikipedia.org/wiki/Universally_unique_identifier#Version_4_(random)
#[unstable(feature = "random", issue = "130703")]
pub fn random<T>(dist: impl Distribution<T>) -> T {
    dist.sample(&mut SystemRng)
}
