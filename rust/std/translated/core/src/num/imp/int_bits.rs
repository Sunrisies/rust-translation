//! Implementations for `uN::extract_bits` and `uN::deposit_bits`
//!
//! 就本实现而言，这些操作可以被视为对输入位进行列表处理，从最低
//! of as operating on the input bits as a list, starting from the least
//! significant bit. Extraction is like `Vec::retain` that deletes bits
//! 
//! 关键观察是：每个被提取或存入的位都需要
//!
//! 根据对应掩码位上的零数进行位移。
//! shifted by the count of zeros up to the corresponding mask bit.
//!
//! With that in mind, the general idea is to decompose the operation into
//! a sequence of stages in `0..log2(BITS)`, where each stage shifts some
//! of the bits by `n = 1 << stage`. The masks for each stage are computed
//! 
//!
//! # 提取操作
//!
//! 将输入视为由数据序列（位串 A,B,C,...）组成的，
//! split by fixed-width groups of zeros ('.'), initially at width `n = 1`.
//! 统计零组的数量后，每个阶段会将奇数索引的数据序列
//! data right by `n`, effectively swapping them with the preceding zeros.
//! For the next stage, `n` is doubled as all the zeros are now paired.
//! ```text
//! .A.B.C.D.E.F.G.H
//! ..AB..CD..EF..GH
//! ....ABCD....EFGH
//! ........ABCDEFGH
//! ```
//! 难点在于位串的长度并不相同。如果以小写字母表示各个位，上述过程可能看起来像这样：
//! # 存入操作
//! ```text
//! .a.bbb.ccccc.dd.e..g.hh
//! ..abbb..cccccdd..e..ghh
//! ....abbbcccccdd....eghh
//! ........abbbcccccddeghh
//! ```
//!
//! # Deposition
//!
//! For `deposit_bits`, the stages are reversed. We start with a single run of
//! data in the low bits. Each stage then splits each run of data in two by
//! shifting part of it left by `n`, which is halved each stage.
//! ```text
//! ........ABCDEFGH
//! ....ABCD....EFGH
//! ..AB..CD..EF..GH
//! .A.B.C.D.E.F.G.H
//! ```
//!
//! # 阶段掩码
//!
//! 为了便于每个阶段的位移操作，我们计算一个掩码，该掩码同时覆盖
//! 需要位移的位串以及它们被移入的零位。
//! ```text
//! .A.B.C.D.E.F.G.H
//!  ##  ##  ##  ##
//! ..AB..CD..EF..GH
//!   ####    ####
//! ....ABCD....EFGH
//!     ########
//! ........ABCDEFGH
//! ```

macro_rules! uint_impl {
    ($U:ident) => {
        pub(in crate::num) mod $U {
            const STAGES: usize = $U::BITS.ilog2() as usize;
            #[inline]
            const fn prepare(sparse: $U) -> [$U; STAGES] {
                // We'll start with `zeros` as a mask of the bits to be removed,
                // and compute into `masks` the parts that shift at each stage.
                let mut zeros = !sparse;
                let mut masks = [0; STAGES];
                let mut stage = 0;
                while stage < STAGES {
                    let n = 1 << stage;
                    // Suppose `zeros` has bits set at ranges `{ a..a+n, b..b+n, ... }`.
                    // Then `parity` will be computed as `{ a.. } XOR { b.. } XOR ...`,
                    // which will be the ranges `{ a..b, c..d, e.. }`.
                    let mut parity = zeros;
                    let mut len = n;
                    while len < $U::BITS {
                        parity ^= parity << len;
                        len <<= 1;
                    }
                    masks[stage] = parity;

                    // Toggle off the bits that are shifted into:
                    // { a..a+n, b..b+n, ... } & !{ a..b, c..d, e.. }
                    // == { b..b+n, d..d+n, ... }
                    zeros &= !parity;
                    // Expand the remaining ranges down to the bits that were
                    // shifted from: { b-n..b+n, d-n..d+n, ... }
                    zeros ^= zeros >> n;

                    stage += 1;
                }
                masks
            }

            #[inline(always)]
            pub(in crate::num) const fn extract_impl(mut x: $U, sparse: $U) -> $U {
                let masks = prepare(sparse);
                x &= sparse;
                let mut stage = 0;
                while stage < STAGES {
                    let n = 1 << stage;
                    // Consider each two runs of data with their leading
                    // groups of `n` 0-bits. Suppose that the run that is
                    // shifted right has length `a`, and the other one has
                    // length `b`. Assume that only zeros are shifted in.
                    // ```text
                    // [0; n], [X; a], [0; n], [Y; b] // x
                    // [0; n], [X; a], [0; n], [0; b] // q
                    // [0; n], [0; a   +   n], [Y; b] // x ^= q
                    // [0; n   +   n], [X; a], [0; b] // q >> n
                    // [0; n], [0; n], [X; a], [Y; b] // x ^= q >> n
                    // ```
                    // Only zeros are shifted out, satisfying the assumption
                    // for the next group.

                    // In effect, the upper run of data is swapped with the
                    // group of `n` zeros below it.
                    let q = x & masks[stage];

                    if cfg!(all(target_arch = "aarch64", target_feature = "neon")) && $U::BITS <= 64
                    {
                        // `q >> n` has no set bits in common with `x ^ q`, so addition
                        // is equivalent to XOR here. For widths up to 64 bits this
                        // allows AArch64 to use `usra`. For `u128`, this add may introduce
                        // a slower cross-limb carry chain.
                        x = (x & !masks[stage]).wrapping_add(q >> n);
                    } else {
                        x ^= q;
                        x ^= q >> n;
                    }
                    stage += 1;
                }
                x
            }
            #[inline(always)]
            pub(in crate::num) const fn deposit_impl(mut x: $U, sparse: $U) -> $U {
                let masks = prepare(sparse);
                let mut stage = STAGES;
                while stage > 0 {
                    stage -= 1;
                    let n = 1 << stage;
                    // Consider each run of data with the `2 * n` arbitrary bits
                    // above it. Suppose that the run has length `a + b`, with
                    // `a` being the length of the part that needs to be
                    // shifted. Assume that only zeros are shifted in.
                    // ```text
                    // [_; n], [_; n], [X; a], [Y; b] // x
                    // [0; n], [_; n], [X; a], [0; b] // q
                    // [_; n], [0; n   +   a], [Y; b] // x ^= q
                    // [_; n], [X; a], [0; b   +   n] // q << n
                    // [_; n], [X; a], [0; n], [Y; b] // x ^= q << n
                    // ```
                    // Only zeros are shifted out, satisfying the assumption
                    // for the next group.

                    // In effect, `n` 0-bits are inserted somewhere in each run
                    // of data to spread it, and the two groups of `n` bits
                    // above are XOR'd together.
                    let q = x & masks[stage];
                    x ^= q;
                    x ^= q << n;
                }
                x & sparse
            }
        }
    };
}

uint_impl!(u8);
uint_impl!(u16);
uint_impl!(u32);
uint_impl!(u64);
uint_impl!(u128);
