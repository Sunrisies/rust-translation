use crate::io::{self, ErrorKind, IoSlice, Result, Seek, SeekFrom, SizeHint, Write};
use crate::{cmp, fmt};

/// `Empty` ignores any data written via [`Write`], and will always be empty
/// (returning zero bytes) when read via [`Read`].
///
/// [`Write`]: crate::io::Write
/// [`Read`]: ../../std/io/trait.Read.html
///
/// This struct is generally created by calling [`empty()`]. Please
/// see the documentation of [`empty()`] for more details.
#[stable(feature = "rust1", since = "1.0.0")]
#[non_exhaustive]
#[derive(Copy, Clone, Debug, Default)]
pub struct Empty;

#[doc(hidden)]
#[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
impl SizeHint for Empty {
    #[inline]
    fn upper_bound(&self) -> Option<usize> {
        Some(0)
    }
}

#[stable(feature = "empty_write", since = "1.73.0")]
impl Write for Empty {
    #[inline]
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        Ok(buf.len())
    }

    #[inline]
    fn write_vectored(&mut self, bufs: &[IoSlice<'_>]) -> io::Result<usize> {
        let total_len = bufs.iter().map(|b| b.len()).sum();
        Ok(total_len)
    }

    #[inline]
    fn is_write_vectored(&self) -> bool {
        true
    }

    #[inline]
    fn write_all(&mut self, _buf: &[u8]) -> io::Result<()> {
        Ok(())
    }

    #[inline]
    fn write_all_vectored(&mut self, _bufs: &mut [IoSlice<'_>]) -> io::Result<()> {
        Ok(())
    }

    #[inline]
    fn write_fmt(&mut self, _args: fmt::Arguments<'_>) -> io::Result<()> {
        Ok(())
    }

    #[inline]
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

#[stable(feature = "empty_write", since = "1.73.0")]
impl Write for &Empty {
    #[inline]
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        Ok(buf.len())
    }

    #[inline]
    fn write_vectored(&mut self, bufs: &[IoSlice<'_>]) -> io::Result<usize> {
        let total_len = bufs.iter().map(|b| b.len()).sum();
        Ok(total_len)
    }

    #[inline]
    fn is_write_vectored(&self) -> bool {
        true
    }

    #[inline]
    fn write_all(&mut self, _buf: &[u8]) -> io::Result<()> {
        Ok(())
    }

    #[inline]
    fn write_all_vectored(&mut self, _bufs: &mut [IoSlice<'_>]) -> io::Result<()> {
        Ok(())
    }

    #[inline]
    fn write_fmt(&mut self, _args: fmt::Arguments<'_>) -> io::Result<()> {
        Ok(())
    }

    #[inline]
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

#[stable(feature = "empty_seek", since = "1.51.0")]
impl Seek for Empty {
    #[inline]
    fn seek(&mut self, _pos: SeekFrom) -> Result<u64> {
        Ok(0)
    }

    #[inline]
    fn stream_len(&mut self) -> Result<u64> {
        Ok(0)
    }

    #[inline]
    fn stream_position(&mut self) -> Result<u64> {
        Ok(0)
    }
}

/// 创建一个在读取时始终处于 EOF 状态的值，并忽略所有写入的数据
///
/// All calls to [`write`] on the returned instance will return [`Ok(buf.len())`]
/// 并且不会检查缓冲区的内容
///
/// All calls to [`read`] from the returned reader will return [`Ok(0)`].
///
/// [`Ok(buf.len())`]: Ok
/// [`Ok(0)`]: Ok
///
/// [`write`]: crate::io::Write::write
/// [`read`]: ../../std/io/trait.Read.html#method.read
///
/// # 示例
///
/// ```rust
/// use std::io::{self, Write};
///
/// let buffer = vec![1, 2, 3, 5, 8];
/// let num_bytes = io::empty().write(&buffer).unwrap();
/// assert_eq!(num_bytes, 5);
/// ```
///
///
/// ```rust
/// use std::io::{self, Read};
///
/// let mut buffer = String::new();
/// io::empty().read_to_string(&mut buffer).unwrap();
/// assert!(buffer.is_empty());
/// ```
#[must_use]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_stable(feature = "const_io_structs", since = "1.79.0")]
pub const fn empty() -> Empty {
    Empty
}

/// 一个不断输出一个字节的读取器，重复无数次
///
/// This struct is generally created by calling [`repeat()`]. Please
/// see the documentation of [`repeat()`] for more details.
#[stable(feature = "rust1", since = "1.0.0")]
#[non_exhaustive]
pub struct Repeat {
    #[doc(hidden)]
    #[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
    pub byte: u8,
}

#[doc(hidden)]
#[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
impl SizeHint for Repeat {
    #[inline]
    fn lower_bound(&self) -> usize {
        usize::MAX
    }

    #[inline]
    fn upper_bound(&self) -> Option<usize> {
        None
    }
}

/// 创建一个无限重复一个字节的读取器实例
///
/// 所有从这个读取器进行的读取都将通过填充指定的缓冲区来完成
/// 给定的字节
///
/// # 示例
///
/// ```
/// use std::io::{self, Read};
///
/// let mut buffer = [0; 3];
/// io::repeat(0b101).read_exact(&mut buffer).unwrap();
/// assert_eq!(buffer, [0b101, 0b101, 0b101]);
/// ```
#[must_use]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_stable(feature = "const_io_structs", since = "1.79.0")]
pub const fn repeat(byte: u8) -> Repeat {
    Repeat { byte }
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl fmt::Debug for Repeat {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Repeat").finish_non_exhaustive()
    }
}

/// 一个将数据移入空位的写入器
///
/// This struct is generally created by calling [`sink()`]. Please
/// see the documentation of [`sink()`] for more details.
#[stable(feature = "rust1", since = "1.0.0")]
#[non_exhaustive]
#[derive(Copy, Clone, Debug, Default)]
pub struct Sink;

#[stable(feature = "rust1", since = "1.0.0")]
impl Write for Sink {
    #[inline]
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        Ok(buf.len())
    }

    #[inline]
    fn write_vectored(&mut self, bufs: &[IoSlice<'_>]) -> io::Result<usize> {
        let total_len = bufs.iter().map(|b| b.len()).sum();
        Ok(total_len)
    }

    #[inline]
    fn is_write_vectored(&self) -> bool {
        true
    }

    #[inline]
    fn write_all(&mut self, _buf: &[u8]) -> io::Result<()> {
        Ok(())
    }

    #[inline]
    fn write_all_vectored(&mut self, _bufs: &mut [IoSlice<'_>]) -> io::Result<()> {
        Ok(())
    }

    #[inline]
    fn write_fmt(&mut self, _args: fmt::Arguments<'_>) -> io::Result<()> {
        Ok(())
    }

    #[inline]
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

#[stable(feature = "write_mt", since = "1.48.0")]
impl Write for &Sink {
    #[inline]
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        Ok(buf.len())
    }

    #[inline]
    fn write_vectored(&mut self, bufs: &[IoSlice<'_>]) -> io::Result<usize> {
        let total_len = bufs.iter().map(|b| b.len()).sum();
        Ok(total_len)
    }

    #[inline]
    fn is_write_vectored(&self) -> bool {
        true
    }

    #[inline]
    fn write_all(&mut self, _buf: &[u8]) -> io::Result<()> {
        Ok(())
    }

    #[inline]
    fn write_all_vectored(&mut self, _bufs: &mut [IoSlice<'_>]) -> io::Result<()> {
        Ok(())
    }

    #[inline]
    fn write_fmt(&mut self, _args: fmt::Arguments<'_>) -> io::Result<()> {
        Ok(())
    }

    #[inline]
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

/// 创建一个能够成功消耗所有数据的写入器实例
///
/// All calls to [`write`] on the returned instance will return [`Ok(buf.len())`]
/// 并且不会检查缓冲区的内容
///
/// [`write`]: crate::io::Write::write
/// [`Ok(buf.len())`]: Ok
///
/// # 示例
///
/// ```rust
/// use std::io::{self, Write};
///
/// let buffer = vec![1, 2, 3, 5, 8];
/// let num_bytes = io::sink().write(&buffer).unwrap();
/// assert_eq!(num_bytes, 5);
/// ```
#[must_use]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_stable(feature = "const_io_structs", since = "1.79.0")]
pub const fn sink() -> Sink {
    Sink
}

/// 连接两个读取器的适配器
///
/// This struct is generally created by calling [`chain`] on a reader.
/// Please see the documentation of [`chain`] for more details.
///
/// [`chain`]: ../../std/io/trait.Read.html#method.chain
#[stable(feature = "rust1", since = "1.0.0")]
#[derive(Debug)]
#[non_exhaustive]
pub struct Chain<T, U> {
    #[doc(hidden)]
    #[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
    pub first: T,
    #[doc(hidden)]
    #[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
    pub second: U,
    #[doc(hidden)]
    #[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
    pub done_first: bool,
}

#[doc(hidden)]
#[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
impl<T, U> SizeHint for Chain<T, U> {
    #[inline]
    fn lower_bound(&self) -> usize {
        SizeHint::lower_bound(&self.first) + SizeHint::lower_bound(&self.second)
    }

    #[inline]
    fn upper_bound(&self) -> Option<usize> {
        match (SizeHint::upper_bound(&self.first), SizeHint::upper_bound(&self.second)) {
            (Some(first), Some(second)) => first.checked_add(second),
            _ => None,
        }
    }
}

impl<T, U> Chain<T, U> {
    /// Consumes the `Chain`, returning the wrapped readers.
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::io;
    /// use std::io::prelude::*;
    /// use std::fs::File;
    ///
    /// fn main() -> io::Result<()> {
    ///     let mut foo_file = File::open("foo.txt")?;
    ///     let mut bar_file = File::open("bar.txt")?;
    ///
    ///     let chain = foo_file.chain(bar_file);
    ///     let (foo_file, bar_file) = chain.into_inner();
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "more_io_inner_methods", since = "1.20.0")]
    pub fn into_inner(self) -> (T, U) {
        (self.first, self.second)
    }

    /// Gets references to the underlying readers in this `Chain`.
    ///
    /// 应注意避免修改底层读取器的内部 I/O 状态，因为这样做可能会破坏此
    /// 的内部状态
    /// `Chain`.
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::io;
    /// use std::io::prelude::*;
    /// use std::fs::File;
    ///
    /// fn main() -> io::Result<()> {
    ///     let mut foo_file = File::open("foo.txt")?;
    ///     let mut bar_file = File::open("bar.txt")?;
    ///
    ///     let chain = foo_file.chain(bar_file);
    ///     let (foo_file, bar_file) = chain.get_ref();
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "more_io_inner_methods", since = "1.20.0")]
    pub fn get_ref(&self) -> (&T, &U) {
        (&self.first, &self.second)
    }

    /// Gets mutable references to the underlying readers in this `Chain`.
    ///
    /// 应注意避免修改底层读取器的内部 I/O 状态，因为这样做可能会破坏此
    /// 的内部状态
    /// `Chain`.
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::io;
    /// use std::io::prelude::*;
    /// use std::fs::File;
    ///
    /// fn main() -> io::Result<()> {
    ///     let mut foo_file = File::open("foo.txt")?;
    ///     let mut bar_file = File::open("bar.txt")?;
    ///
    ///     let mut chain = foo_file.chain(bar_file);
    ///     let (foo_file, bar_file) = chain.get_mut();
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "more_io_inner_methods", since = "1.20.0")]
    pub fn get_mut(&mut self) -> (&mut T, &mut U) {
        (&mut self.first, &mut self.second)
    }
}

#[doc(hidden)]
#[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
#[must_use]
#[inline]
pub const fn chain<T, U>(first: T, second: U) -> Chain<T, U> {
    Chain { first, second, done_first: false }
}

/// 限制从底层读取器读取字节数的读取器适配器
///
/// This struct is generally created by calling [`take`] on a reader.
/// Please see the documentation of [`take`] for more details.
///
/// [`take`]: ../../std/io/trait.Read.html#method.take
#[stable(feature = "rust1", since = "1.0.0")]
#[derive(Debug)]
#[non_exhaustive]
pub struct Take<T> {
    #[doc(hidden)]
    #[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
    pub inner: T,
    #[doc(hidden)]
    #[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
    pub len: u64,
    #[doc(hidden)]
    #[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
    pub limit: u64,
}

#[doc(hidden)]
#[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
impl<T> SizeHint for Take<T> {
    #[inline]
    fn lower_bound(&self) -> usize {
        cmp::min(SizeHint::lower_bound(&self.inner) as u64, self.limit) as usize
    }

    #[inline]
    fn upper_bound(&self) -> Option<usize> {
        match SizeHint::upper_bound(&self.inner) {
            Some(upper_bound) => Some(cmp::min(upper_bound as u64, self.limit) as usize),
            None => self.limit.try_into().ok(),
        }
    }
}

impl<T> Take<T> {
    /// 返回在此实例将
    /// 返回 EOF 之前可以读取的字节数
    ///
    /// # 注意
    ///
    /// This instance may reach `EOF` after reading fewer bytes than indicated by
    /// this method if the underlying [`Read`] instance reaches EOF.
    ///
    /// [`Read`]: ../../std/io/trait.Read.html
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::io;
    /// use std::io::prelude::*;
    /// use std::fs::File;
    ///
    /// fn main() -> io::Result<()> {
    ///     let f = File::open("foo.txt")?;
    ///
    ///     // read at most five bytes
    ///     let handle = f.take(5);
    ///
    ///     println!("limit: {}", handle.limit());
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn limit(&self) -> u64 {
        self.limit
    }

    /// 返回当前已读取的字节数。
    #[unstable(feature = "seek_io_take_position", issue = "97227")]
    #[inline]
    pub fn position(&self) -> u64 {
        self.len - self.limit
    }

    /// 设置在此实例即将
    /// return EOF. This is the same as constructing a new `Take` instance, so
    /// 当调用此方法时，已读取的字节数和之前的限制值无关紧要。
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::io;
    /// use std::io::prelude::*;
    /// use std::fs::File;
    ///
    /// fn main() -> io::Result<()> {
    ///     let f = File::open("foo.txt")?;
    ///
    ///     // read at most five bytes
    ///     let mut handle = f.take(5);
    ///     handle.set_limit(10);
    ///
    ///     assert_eq!(handle.limit(), 10);
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "take_set_limit", since = "1.27.0")]
    pub fn set_limit(&mut self, limit: u64) {
        self.len = limit;
        self.limit = limit;
    }

    /// Consumes the `Take`, returning the wrapped reader.
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::io;
    /// use std::io::prelude::*;
    /// use std::fs::File;
    ///
    /// fn main() -> io::Result<()> {
    ///     let mut file = File::open("foo.txt")?;
    ///
    ///     let mut buffer = [0; 5];
    ///     let mut handle = file.take(5);
    ///     handle.read(&mut buffer)?;
    ///
    ///     let file = handle.into_inner();
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "io_take_into_inner", since = "1.15.0")]
    pub fn into_inner(self) -> T {
        self.inner
    }

    /// 获取对底层读取器的引用。
    ///
    /// 应注意避免修改底层读取器的内部 I/O 状态，因为这样做可能会破坏此
    /// 底层读取器的内部限制值。
    /// `Take`.
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::io;
    /// use std::io::prelude::*;
    /// use std::fs::File;
    ///
    /// fn main() -> io::Result<()> {
    ///     let mut file = File::open("foo.txt")?;
    ///
    ///     let mut buffer = [0; 5];
    ///     let mut handle = file.take(5);
    ///     handle.read(&mut buffer)?;
    ///
    ///     let file = handle.get_ref();
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "more_io_inner_methods", since = "1.20.0")]
    pub fn get_ref(&self) -> &T {
        &self.inner
    }

    /// 获取对底层读取器的可修改引用。
    ///
    /// 应注意避免修改底层读取器的内部 I/O 状态，因为这样做可能会破坏此
    /// 底层读取器的内部限制值。
    /// `Take`.
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::io;
    /// use std::io::prelude::*;
    /// use std::fs::File;
    ///
    /// fn main() -> io::Result<()> {
    ///     let mut file = File::open("foo.txt")?;
    ///
    ///     let mut buffer = [0; 5];
    ///     let mut handle = file.take(5);
    ///     handle.read(&mut buffer)?;
    ///
    ///     let file = handle.get_mut();
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "more_io_inner_methods", since = "1.20.0")]
    pub fn get_mut(&mut self) -> &mut T {
        &mut self.inner
    }
}

#[stable(feature = "seek_io_take", since = "1.89.0")]
impl<T: Seek> Seek for Take<T> {
    fn seek(&mut self, pos: SeekFrom) -> Result<u64> {
        let new_position = match pos {
            SeekFrom::Start(v) => Some(v),
            SeekFrom::Current(v) => self.position().checked_add_signed(v),
            SeekFrom::End(v) => self.len.checked_add_signed(v),
        };
        let new_position = match new_position {
            Some(v) if v <= self.len => v,
            _ => return Err(ErrorKind::InvalidInput.into()),
        };
        while new_position != self.position() {
            if let Some(offset) = new_position.checked_signed_diff(self.position()) {
                self.inner.seek_relative(offset)?;
                self.limit = self.limit.wrapping_sub(offset as u64);
                break;
            }
            let offset = if new_position > self.position() { i64::MAX } else { i64::MIN };
            self.inner.seek_relative(offset)?;
            self.limit = self.limit.wrapping_sub(offset as u64);
        }
        Ok(new_position)
    }

    fn stream_len(&mut self) -> Result<u64> {
        Ok(self.len)
    }

    fn stream_position(&mut self) -> Result<u64> {
        Ok(self.position())
    }

    fn seek_relative(&mut self, offset: i64) -> Result<()> {
        if !self.position().checked_add_signed(offset).is_some_and(|p| p <= self.len) {
            return Err(ErrorKind::InvalidInput.into());
        }
        self.inner.seek_relative(offset)?;
        self.limit = self.limit.wrapping_sub(offset as u64);
        Ok(())
    }
}

#[doc(hidden)]
#[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
#[must_use]
#[inline]
pub const fn take<T>(inner: T, limit: u64) -> Take<T> {
    Take { inner, limit, len: limit }
}
