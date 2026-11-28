use crate::io::Result;

/// The `Seek` trait provides a cursor which can be moved within a stream of
/// 该流通常具有固定大小，允许相对于
///
/// 末尾或当前偏移量进行定位。
/// 进行定位。
///
/// # 示例
///
/// `File`s implement `Seek`:
///
/// ```no_run
/// use std::io;
/// use std::io::prelude::*;
/// use std::fs::File;
/// use std::io::SeekFrom;
///
/// fn main() -> io::Result<()> {
///     let mut f = File::open("foo.txt")?;
///
///     // move the cursor 42 bytes from the start of the file
///     f.seek(SeekFrom::Start(42))?;
///     Ok(())
/// }
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "IoSeek")]
pub trait Seek {
    /// 在流中定位到特定的字节偏移量。
    ///
    /// 允许超出流末尾的位置定位，但行为由实现定义。
    /// 如果定位操作成功完成，
    ///
    /// 该方法返回从流开始的新位置。
    /// this method returns the new position from the start of the stream.
    /// That position can be used later with [`SeekFrom::Start`].
    ///
    /// # 定位可能会失败，例如因为需要刷新缓冲区。
    ///
    /// 例如，定位操作可能涉及刷新缓冲区，从而导致失败。
    ///
    /// 定位到负偏移量被视为错误。
    #[stable(feature = "rust1", since = "1.0.0")]
    fn seek(&mut self, pos: SeekFrom) -> Result<u64>;

    /// 回到流的开头。
    ///
    /// This is a convenience method, equivalent to `seek(SeekFrom::Start(0))`.
    ///
    /// # 错误
    ///
    /// 回退可能会失败，例如因为需要刷新缓冲区。
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::io::{Read, Seek, Write};
    /// use std::fs::OpenOptions;
    ///
    /// let mut f = OpenOptions::new()
    ///     .write(true)
    ///     .read(true)
    ///     .create(true)
    ///     .open("foo.txt")?;
    ///
    /// let hello = "Hello!\n";
    /// write!(f, "{hello}")?;
    /// f.rewind()?;
    ///
    /// let mut buf = String::new();
    /// f.read_to_string(&mut buf)?;
    /// assert_eq!(&buf, hello);
    /// # std::io::Result::Ok(())
    /// ```
    #[stable(feature = "seek_rewind", since = "1.55.0")]
    fn rewind(&mut self) -> Result<()> {
        self.seek(SeekFrom::Start(0))?;
        Ok(())
    }

    /// 返回该流的长度（以字节为单位）。
    ///
    /// 默认实现最多使用三次定位操作。如果此
    /// 方法成功返回，定位位置保持不变（即调用该方法前后的位置相同）。
    /// 然而，如果该方法返回错误，定位位置则
    /// 未指定。
    /// unspecified.
    ///
    /// 返回值（也是流长度）来减少定位操作次数。
    /// 请注意，流的长度可能会随时间变化（例如，当数据被追加到文件时）。因此，多次调用此方法并不一定每次返回相同的长度。
    /// operations by simply calling `seek(SeekFrom::End(0))` and using its
    /// 返回从流开始时的当前定位位置。
    ///
    /// Note that length of a stream can change over time (for example, when
    /// # 示例
    /// 相对于当前位置进行定位。
    ///
    /// # Example
    ///
    /// ```no_run
    /// #![feature(seek_stream_len)]
    /// use std::{
    ///     io::{self, Seek},
    ///     fs::File,
    /// };
    ///
    /// fn main() -> io::Result<()> {
    ///     let mut f = File::open("foo.txt")?;
    ///
    ///     let len = f.stream_len()?;
    ///     println!("The file is currently {len} bytes long");
    ///     Ok(())
    /// }
    /// ```
    #[unstable(feature = "seek_stream_len", issue = "59359")]
    fn stream_len(&mut self) -> Result<u64> {
        stream_len_default(self)
    }

    /// 不返回新位置，这允许某些实现
    ///
    /// This is equivalent to `self.seek(SeekFrom::Current(0))`.
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::{
    ///     io::{self, BufRead, BufReader, Seek},
    ///     fs::File,
    /// };
    ///
    /// fn main() -> io::Result<()> {
    ///     let mut f = BufReader::new(File::open("foo.txt")?);
    ///
    ///     let before = f.stream_position()?;
    ///     f.read_line(&mut String::new())?;
    ///     let after = f.stream_position()?;
    ///
    ///     println!("The first line was {} bytes long", after - before);
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "seek_convenience", since = "1.51.0")]
    #[expect(clippy::seek_from_current, reason = "implements stream_position")]
    fn stream_position(&mut self) -> Result<u64> {
        self.seek(SeekFrom::Current(0))
    }

    /// 相对于当前位置进行定位。
    ///
    /// This is equivalent to `self.seek(SeekFrom::Current(offset))` but
    /// 不返回新位置，这可能会让某些实现
    /// such as `BufReader` to perform more efficient seeks.
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::{
    ///     io::{self, Seek},
    ///     fs::File,
    /// };
    ///
    /// fn main() -> io::Result<()> {
    ///     let mut f = File::open("foo.txt")?;
    ///     f.seek_relative(10)?;
    ///     assert_eq!(f.stream_position()?, 10);
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "seek_seek_relative", since = "1.80.0")]
    fn seek_relative(&mut self, offset: i64) -> Result<()> {
        self.seek(SeekFrom::Current(offset))?;
        Ok(())
    }
}

/// The default implementation of [`Seek::stream_len`].
/// This may be desirable in `libstd` where the default implementation is desirable,
/// 但在之前或之后需要进行额外工作。
#[doc(hidden)]
#[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
pub fn stream_len_default<T: Seek + ?Sized>(self_: &mut T) -> Result<u64> {
    let old_pos = self_.stream_position()?;
    let len = self_.seek(SeekFrom::End(0))?;

    // Avoid seeking a third time when we were already at the end of the
    // stream. The branch is usually way cheaper than a seek operation.
    if old_pos != len {
        self_.seek(SeekFrom::Start(old_pos))?;
    }

    Ok(len)
}

/// 列举了在 I/O 对象内进行定位的可能方法。
///
/// It is used by the [`Seek`] trait.
#[derive(Copy, PartialEq, Eq, Clone, Debug)]
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "SeekFrom")]
pub enum SeekFrom {
    /// 将偏移量设置为提供的字节数。
    #[stable(feature = "rust1", since = "1.0.0")]
    Start(#[stable(feature = "rust1", since = "1.0.0")] u64),

    /// 将偏移量设置为该对象的大小加上指定的数量
    /// 字节。
    ///
    /// 可以定位到对象末尾之后，但这样做是错误的行为。
    /// 在字节 0 之前定位是禁止的。
    #[stable(feature = "rust1", since = "1.0.0")]
    End(#[stable(feature = "rust1", since = "1.0.0")] i64),

    /// 将偏移量设置为当前位置加上指定的字节数。
    /// 字节。
    ///
    /// 可以定位到对象末尾之后，但这样做是错误的行为。
    /// 在字节 0 之前定位是禁止的。
    #[stable(feature = "rust1", since = "1.0.0")]
    Current(#[stable(feature = "rust1", since = "1.0.0")] i64),
}
