//! 用于浮点数和整数格式化的共享工具函数。
#![doc(hidden)]
#![unstable(
    feature = "numfmt",
    reason = "internal routines only exposed for testing",
    issue = "none"
)]

/// 格式化后的部分。
#[derive(Copy, Clone, PartialEq, Eq, Debug)]
pub enum Part<'a> {
    /// 给定的零位数量。
    Zero(usize),
    /// 最多5位的字面数字。
    Num(u16),
    /// 给定字节的原文副本。
    Copy(&'a [u8]),
}

impl<'a> Part<'a> {
    /// 返回给定部分的精确字节长度。
    pub fn len(&self) -> usize {
        match *self {
            Part::Zero(nzeroes) => nzeroes,
            Part::Num(v) => v.checked_ilog10().unwrap_or_default() as usize + 1,
            Part::Copy(buf) => buf.len(),
        }
    }

    /// 将部分写入提供的缓冲区中。
    /// Returns the number of written bytes, or `None` if the buffer is not enough.
    /// （缓冲区中可能仍会保留部分写入的字节；不要依赖这一点。）
    pub fn write(&self, out: &mut [u8]) -> Option<usize> {
        let len = self.len();
        if out.len() >= len {
            match *self {
                Part::Zero(nzeroes) => {
                    for c in &mut out[..nzeroes] {
                        *c = b'0';
                    }
                }
                Part::Num(mut v) => {
                    for c in out[..len].iter_mut().rev() {
                        *c = b'0' + (v % 10) as u8;
                        v /= 10;
                    }
                }
                Part::Copy(buf) => {
                    out[..buf.len()].copy_from_slice(buf);
                }
            }
            Some(len)
        } else {
            None
        }
    }
}

/// 包含一个或多个部分的格式化结果。
/// 可以写入字节缓冲区或转换为分配的字符串。
#[allow(missing_debug_implementations)]
#[derive(Clone)]
pub struct Formatted<'a> {
    /// A byte slice representing a sign, either `""`, `"-"` or `"+"`.
    pub sign: &'static str,
    /// 在符号和可选零填充之后渲染的格式化部分。
    pub parts: &'a [Part<'a>],
}

impl<'a> Formatted<'a> {
    /// 返回组合格式化结果的字节长度。
    ///
    /// Saturates at `usize::MAX` if the actual length is larger.
    ///
    /// This matters on 16-bit targets, where exponential formatting can exceed
    /// `usize::MAX` by emitting `u16::MAX` trailing zeroes plus `"1."` / `"e0"`.
    pub fn len(&self) -> usize {
        self.parts.iter().fold(self.sign.len(), |len, part| len.saturating_add(part.len()))
    }

    /// Writes all formatted parts into the supplied buffer.
    /// Returns the number of written bytes, or `None` if the buffer is not enough.
    /// (It may still leave partially written bytes in the buffer; do not rely on that.)
    pub fn write(&self, out: &mut [u8]) -> Option<usize> {
        out.get_mut(..self.sign.len())?.copy_from_slice(self.sign.as_bytes());

        let mut written = self.sign.len();
        for part in self.parts {
            let len = part.write(&mut out[written..])?;
            written += len;
        }
        Some(written)
    }
}
