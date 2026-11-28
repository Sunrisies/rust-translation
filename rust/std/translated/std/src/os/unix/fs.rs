//! Unix-specific extensions to primitives in the [`std::fs`] module.
//!
//! [`std::fs`]: crate::fs

#![stable(feature = "rust1", since = "1.0.0")]

#[allow(unused_imports)]
use io::{Read, Write};

use super::platform::fs::MetadataExt as _;
// Used for `File::read` on intra-doc links
use crate::ffi::OsStr;
use crate::fs::{self, OpenOptions, Permissions};
use crate::io::BorrowedCursor;
use crate::macros::rustdoc_skip_body;
use crate::os::unix::io::{AsFd, AsRawFd};
use crate::path::Path;
use crate::sys::{AsInner, AsInnerMut, FromInner};
use crate::{io, sys};

// Tests for this module
#[cfg(not(target_os = "l4re"))]
#[cfg(test)]
mod tests;

pub(crate) mod dirs;

#[unstable(feature = "fs_media_dirs", issue = "162083")]
pub use dirs::MediaDirsExt;
#[unstable(feature = "fs_home_dirs", issue = "162082")]
pub use dirs::{HomeDirsExt, XdgDirs};

/// Unix-specific extensions to [`fs::File`].
#[stable(feature = "file_offset", since = "1.15.0")]
pub trait FileExt {
    /// 从指定偏移量开始读取若干字节。
    ///
    /// 返回读取的字节数。
    ///
    /// 偏移量相对于文件起始位置，因此独立于当前光标位置。
    /// 此函数不影响当前文件光标。
    ///
    /// The current file cursor is not affected by this function.
    ///
    /// Note that similar to [`File::read`], it is not an error to return with a
    /// # 示例
    ///
    /// [`File::read`]: fs::File::read
    ///
    /// # 示例
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// use std::io;
    /// use std::fs::File;
    /// use std::os::unix::prelude::FileExt;
    ///
    /// fn main() -> io::Result<()> {
    /// let mut buf = [0u8; 8];
    /// let file = File::open("foo.txt")?;
    ///
    /// // 我们现在从偏移量 10 开始读取 8 字节。
    /// let num_bytes_read = file.read_at(&mut buf, 10)?;
    /// println!("读取了 {num_bytes_read} 字节: {buf:?}");
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "file_offset", since = "1.15.0")]
    fn read_at(&self, buf: &mut [u8], offset: u64) -> io::Result<usize>;

    /// Like `read_at`, except that it reads into a slice of buffers.
    ///
    /// Data is copied to fill each buffer in order, with the final buffer
    /// written to possibly being only partially filled. This method must behave
    /// equivalently to a single call to read with concatenated buffers.
    #[unstable(feature = "unix_file_vectored_at", issue = "89517")]
    fn read_vectored_at(&self, bufs: &mut [io::IoSliceMut<'_>], offset: u64) -> io::Result<usize> {
        io::default_read_vectored(|b| self.read_at(b, offset), bufs)
    }

    /// Reads the exact number of bytes required to fill `buf` from the given offset.
    ///
    /// The offset is relative to the start of the file and thus independent
    /// from the current cursor.
    ///
    /// The current file cursor is not affected by this function.
    ///
    /// Similar to [`io::Read::read_exact`] but uses [`read_at`] instead of `read`.
    ///
    /// [`read_at`]: FileExt::read_at
    ///
    /// # Errors
    ///
    /// If this function encounters an error of the kind
    /// [`io::ErrorKind::Interrupted`] then the error is ignored and the operation
    /// will continue.
    ///
    /// If this function encounters an "end of file" before completely filling
    /// the buffer, it returns an error of the kind [`io::ErrorKind::UnexpectedEof`].
    /// The contents of `buf` are unspecified in this case.
    ///
    /// If any other read error is encountered then this function immediately
    /// returns. The contents of `buf` are unspecified in this case.
    ///
    /// If this function returns an error, it is unspecified how many bytes it
    /// has read, but it will never read more than would be necessary to
    /// completely fill the buffer.
    ///
    /// # Examples
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// use std::io;
    /// use std::fs::File;
    /// use std::os::unix::prelude::FileExt;
    ///
    /// fn main() -> io::Result<()> {
    ///     let mut buf = [0u8; 8];
    ///     let file = File::open("foo.txt")?;
    ///
    ///     // We now read exactly 8 bytes from the offset 10.
    ///     file.read_exact_at(&mut buf, 10)?;
    ///     println!("read {} bytes: {:?}", buf.len(), buf);
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "rw_exact_all_at", since = "1.33.0")]
    fn read_exact_at(&self, mut buf: &mut [u8], mut offset: u64) -> io::Result<()> {
        while !buf.is_empty() {
            match self.read_at(buf, offset) {
                Ok(0) => break,
                Ok(n) => {
                    let tmp = buf;
                    buf = &mut tmp[n..];
                    offset += n as u64;
                }
                Err(ref e) if e.is_interrupted() => {}
                Err(e) => return Err(e),
            }
        }
        if !buf.is_empty() { Err(io::Error::READ_EXACT_EOF) } else { Ok(()) }
    }

    /// 从指定偏移量开始将一些字节读入缓冲区。
    ///
    /// This equivalent to the [`read_at`](FileExt::read_at) method, except that it is passed a
    /// [`BorrowedCursor`] rather than `&mut [u8]` to allow use with uninitialized buffers. The new
    /// data will be appended to any existing contents of `buf`.
    ///
    /// # 示例
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// #![feature(core_io_borrowed_buf)]
    /// #![feature(read_buf_at)]
    ///
    /// use std::io;
    /// use std::io::BorrowedBuf;
    /// use std::fs::File;
    /// use std::mem::MaybeUninit;
    /// use std::os::unix::prelude::*;
    ///
    /// fn main() -> io::Result<()> {
    /// let mut file = File::open("pi.txt")?;
    ///
    /// // 从偏移量 2 开始读取一些字节
    ///     let mut buf: [MaybeUninit<u8>; 10] = [MaybeUninit::uninit(); 10];
    /// let mut buf = BorrowedBuf::from(buf.as_mut_slice());
    /// file.read_buf_at(buf.unfilled(), 2)?;
    ///
    /// assert!(buf.filled().starts_with(b"1"));
    ///
    ///     Ok(())
    /// }
    /// ```
    #[unstable(feature = "read_buf_at", issue = "140771")]
    fn read_buf_at(&self, buf: BorrowedCursor<'_, u8>, offset: u64) -> io::Result<()> {
        io::default_read_buf(|b| self.read_at(b, offset), buf)
    }

    /// Reads the exact number of bytes required to fill the buffer from a given offset.
    ///
    /// This is equivalent to the [`read_exact_at`](FileExt::read_exact_at) method, except that it
    /// is passed a [`BorrowedCursor`] rather than `&mut [u8]` to allow use with uninitialized
    /// buffers. The new data will be appended to any existing contents of `buf`.
    ///
    /// # Examples
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// #![feature(core_io_borrowed_buf)]
    /// #![feature(read_buf_at)]
    ///
    /// use std::io;
    /// use std::io::BorrowedBuf;
    /// use std::fs::File;
    /// use std::mem::MaybeUninit;
    /// use std::os::unix::prelude::*;
    ///
    /// fn main() -> io::Result<()> {
    ///     let mut file = File::open("pi.txt")?;
    ///
    ///     // Read exactly 10 bytes starting from offset 2
    ///     let mut buf: [MaybeUninit<u8>; 10] = [MaybeUninit::uninit(); 10];
    ///     let mut buf = BorrowedBuf::from(buf.as_mut_slice());
    ///     file.read_buf_exact_at(buf.unfilled(), 2)?;
    ///
    ///     assert_eq!(buf.filled(), b"1415926535");
    ///
    ///     Ok(())
    /// }
    /// ```
    #[unstable(feature = "read_buf_at", issue = "140771")]
    #[doc(alias("read_exact_buf_at"))]
    fn read_buf_exact_at(
        &self,
        mut buf: BorrowedCursor<'_, u8>,
        mut offset: u64,
    ) -> io::Result<()> {
        while buf.capacity() > 0 {
            let prev_written = buf.written();
            match self.read_buf_at(buf.reborrow(), offset) {
                Ok(()) => {}
                Err(e) if e.is_interrupted() => continue,
                Err(e) => return Err(e),
            }
            let n = buf.written() - prev_written;
            offset += n as u64;
            if n == 0 {
                return Err(io::Error::READ_EXACT_EOF);
            }
        }
        Ok(())
    }

    /// 从指定偏移量开始写入若干字节。
    ///
    /// 返回写入的字节数。
    ///
    /// 偏移量相对于文件起始位置，因此独立于当前光标位置。
    /// 此函数不影响当前文件光标。
    ///
    /// 当前文件光标不受此函数影响。
    ///
    /// 当写入超出文件末尾时，文件会被适当扩展，中间字节被初始化为值 0。
    /// extended and the intermediate bytes are initialized with the value 0.
    ///
    /// Note that similar to [`File::write`], it is not an error to return a
    /// short write.
    ///
    /// # 错误
    /// On some systems, `write_at` utilises [`pwrite64`] to write to files.
    /// However, this syscall has a [bug] where files opened with the `O_APPEND`
    /// 总是将内容追加到文件的末尾，而不遵守偏移量参数。
    /// 该标志可能被意外设置，如下例所示。
    ///
    /// It is possible to inadvertently set this flag, like in the example below.
    /// 因此，在更改选项时保持警惕以规避意外行为非常重要。
    /// 非常重要。
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// 使用 std::fs::File;
    /// 使用 std::io;
    /// 使用 std::os::unix::prelude::FileExt;
    ///
    /// fn main() -> io::Result<()> {
    ///     // Open a file with the append option (sets the `O_APPEND` flag)
    /// let file = File::options().append(true).open("foo.txt")?;
    ///
    /// // 我们尝试在偏移量 10 处写入；但实际上被追加到了 EOF
    /// file.write_at(b"sushi", 10)?;
    ///
    /// // foo.txt 的长度为 5 字节，而不是 15 字节
    ///     Ok(())
    /// }
    /// ```
    ///
    /// [`File::write`]: fs::File::write
    /// [`pwrite64`]: https://man7.org/linux/man-pages/man2/pwrite.2.html
    /// [bug]: https://man7.org/linux/man-pages/man2/pwrite.2.html#BUGS
    ///
    /// # Examples
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// use std::fs::File;
    /// use std::io;
    /// use std::os::unix::prelude::FileExt;
    ///
    /// fn main() -> io::Result<()> {
    ///     let file = File::create("foo.txt")?;
    ///
    ///     // We now write at the offset 10.
    ///     file.write_at(b"sushi", 10)?;
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "file_offset", since = "1.15.0")]
    fn write_at(&self, buf: &[u8], offset: u64) -> io::Result<usize>;

    /// Like `write_at`, except that it writes from a slice of buffers.
    ///
    /// 数据按顺序从每个缓冲区复制，最后读取最后一个缓冲区
    /// 可能只被部分消耗。这种方法必须表现得像
    /// a call to `write_at` with the buffers concatenated would.
    #[unstable(feature = "unix_file_vectored_at", issue = "89517")]
    fn write_vectored_at(&self, bufs: &[io::IoSlice<'_>], offset: u64) -> io::Result<usize> {
        io::default_write_vectored(|b| self.write_at(b, offset), bufs)
    }

    /// 尝试从给定偏移量开始写入整个缓冲区。
    ///
    /// 偏移量相对于文件起始位置，因此独立于当前光标。
    /// 此函数不影响当前的文件光标。
    ///
    /// The current file cursor is not affected by this function.
    ///
    /// This method will continuously call [`write_at`] until there is no more data
    /// to be written or an error of non-[`io::ErrorKind::Interrupted`] kind is
    /// # 错误
    /// successfully written or such an error occurs. The first error that is
    /// not of [`io::ErrorKind::Interrupted`] kind generated from this method will be
    /// 使用 std::fs::File;
    ///
    /// # 使用 std::io;
    ///
    /// 使用 std::os::unix::prelude::FileExt;
    /// non-[`io::ErrorKind::Interrupted`] kind that [`write_at`] returns.
    ///
    /// [`write_at`]: FileExt::write_at
    ///
    /// # 示例
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// 使用 std::fs::File;
    /// 使用 std::io;
    /// 使用 std::os::unix::prelude::FileExt;
    ///
    /// fn main() -> io::Result<()> {
    /// let file = File::open("foo.txt")?;
    ///
    /// // 我们现在在偏移量 10 处写入。
    /// file.write_all_at(b"sushi", 10)?;
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "rw_exact_all_at", since = "1.33.0")]
    fn write_all_at(&self, mut buf: &[u8], mut offset: u64) -> io::Result<()> {
        while !buf.is_empty() {
            match self.write_at(buf, offset) {
                Ok(0) => {
                    return Err(io::Error::WRITE_ALL_EOF);
                }
                Ok(n) => {
                    buf = &buf[n..];
                    offset += n as u64
                }
                Err(ref e) if e.is_interrupted() => {}
                Err(e) => return Err(e),
            }
        }
        Ok(())
    }
}

#[stable(feature = "file_offset", since = "1.15.0")]
impl FileExt for fs::File {
    fn read_at(&self, buf: &mut [u8], offset: u64) -> io::Result<usize> {
        self.as_inner().read_at(buf, offset)
    }
    fn read_buf_at(&self, buf: BorrowedCursor<'_, u8>, offset: u64) -> io::Result<()> {
        self.as_inner().read_buf_at(buf, offset)
    }
    #[rustdoc_skip_body]
    fn read_vectored_at(&self, bufs: &mut [io::IoSliceMut<'_>], offset: u64) -> io::Result<usize> {
        self.as_inner().read_vectored_at(bufs, offset)
    }
    fn write_at(&self, buf: &[u8], offset: u64) -> io::Result<usize> {
        self.as_inner().write_at(buf, offset)
    }
    #[rustdoc_skip_body]
    fn write_vectored_at(&self, bufs: &[io::IoSlice<'_>], offset: u64) -> io::Result<usize> {
        self.as_inner().write_vectored_at(bufs, offset)
    }
}

/// Unix-specific extensions to [`fs::Permissions`].
///
/// # Examples
///
#[cfg_attr(target_family = "unix", doc = "```no_run")]
#[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
/// use std::fs::{File, Permissions};
/// use std::io::{ErrorKind, Result as IoResult};
/// use std::os::unix::fs::PermissionsExt;
///
/// fn main() -> IoResult<()> {
///     let name = "test_file_for_permissions";
///
///     // make sure file does not exist
///     let _ = std::fs::remove_file(name);
///     assert_eq!(
///         File::open(name).unwrap_err().kind(),
///         ErrorKind::NotFound,
///         "file already exists"
///     );
///
///     // full read/write/execute mode bits for owner of file
///     // that we want to add to existing mode bits
///     let my_mode = 0o700;
///
///     // create new file with specified permissions
///     {
///         let file = File::create(name)?;
///         let mut permissions = file.metadata()?.permissions();
///         eprintln!("Current permissions: {:o}", permissions.mode());
///
///         // make sure new permissions are not already set
///         assert!(
///             permissions.mode() & my_mode != my_mode,
///             "permissions already set"
///         );
///
///         // either use `set_mode` to change an existing Permissions struct
///         permissions.set_mode(permissions.mode() | my_mode);
///
///         // or use `from_mode` to construct a new Permissions struct
///         permissions = Permissions::from_mode(permissions.mode() | my_mode);
///
///         // write new permissions to file
///         file.set_permissions(permissions)?;
///     }
///
///     let permissions = File::open(name)?.metadata()?.permissions();
///     eprintln!("New permissions: {:o}", permissions.mode());
///
///     // assert new permissions were set
///     assert_eq!(
///         permissions.mode() & my_mode,
///         my_mode,
///         "new permissions not set"
///     );
///     Ok(())
/// }
/// ```
///
#[cfg_attr(target_family = "unix", doc = "```no_run")]
#[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
/// 使用 std::fs::Permissions;
/// 使用 std::os::unix::fs::PermissionsExt;
///
/// // 所有者可读写，其他用户仅可读
/// let my_mode = 0o644;
/// let mut permissions = Permissions::from_mode(my_mode);
/// assert_eq!(permissions.mode(), my_mode);
///
/// // 所有者可读写可执行
/// let other_mode = 0o700;
/// permissions.set_mode(other_mode);
/// assert_eq!(permissions.mode(), other_mode);
/// ```
#[stable(feature = "fs_ext", since = "1.1.0")]
pub trait PermissionsExt {
    /// Returns the mode permission bits
    #[stable(feature = "fs_ext", since = "1.1.0")]
    fn mode(&self) -> u32;

    /// Sets the mode permission bits.
    #[stable(feature = "fs_ext", since = "1.1.0")]
    fn set_mode(&mut self, mode: u32);

    /// Creates a new instance from the given mode permission bits.
    #[stable(feature = "fs_ext", since = "1.1.0")]
    #[cfg_attr(not(test), rustc_diagnostic_item = "permissions_from_mode")]
    fn from_mode(mode: u32) -> Self;
}

#[stable(feature = "fs_ext", since = "1.1.0")]
impl PermissionsExt for Permissions {
    #[rustdoc_skip_body]
    fn mode(&self) -> u32 {
        self.as_inner().mode()
    }

    fn set_mode(&mut self, mode: u32) {
        *self = Permissions::from_inner(FromInner::from_inner(mode));
    }

    fn from_mode(mode: u32) -> Permissions {
        Permissions::from_inner(FromInner::from_inner(mode))
    }
}

/// Unix-specific extensions to [`fs::OpenOptions`].
#[stable(feature = "fs_ext", since = "1.1.0")]
pub trait OpenOptionsExt {
    /// Sets the mode bits that a new file will be created with.
    ///
    /// If a new file is created as part of an `OpenOptions::open` call then this
    /// specified `mode` will be used as the permission bits for the new file.
    /// If no `mode` is set, the default of `0o666` will be used.
    /// The operating system masks out bits with the system's `umask`, to produce
    /// the final permissions.
    ///
    /// # Examples
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// use std::fs::OpenOptions;
    /// use std::os::unix::fs::OpenOptionsExt;
    ///
    /// # fn main() {
    /// let mut options = OpenOptions::new();
    /// options.mode(0o644); // Give read/write for owner and read for others.
    /// let file = options.open("foo.txt");
    /// # }
    /// ```
    #[stable(feature = "fs_ext", since = "1.1.0")]
    fn mode(&mut self, mode: u32) -> &mut Self;

    /// Pass custom flags to the `flags` argument of `open`.
    ///
    /// The bits that define the access mode are masked out with `O_ACCMODE`, to
    /// 确保它们不会干扰 Rust 选项设置的访问模式。
    ///
    /// 自定义标志只能设置标志，不能移除 Rust 选项设置的标志。
    /// 此函数会覆盖之前设置的自定义标志。
    ///
    /// # 示例
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// # mod libc { pub const O_NOFOLLOW: i32 = 0; }
    /// use std::fs::OpenOptions;
    /// use std::os::unix::fs::OpenOptionsExt;
    ///
    /// # fn main() {
    /// let mut options = OpenOptions::new();
    /// options.write(true);
    /// options.custom_flags(libc::O_NOFOLLOW);
    /// let file = options.open("foo.txt");
    /// # }
    /// ```
    #[stable(feature = "open_options_ext", since = "1.10.0")]
    fn custom_flags(&mut self, flags: i32) -> &mut Self;
}

#[stable(feature = "fs_ext", since = "1.1.0")]
impl OpenOptionsExt for OpenOptions {
    #[rustdoc_skip_body]
    fn mode(&mut self, mode: u32) -> &mut OpenOptions {
        self.as_inner_mut().mode(mode);
        self
    }

    #[rustdoc_skip_body]
    fn custom_flags(&mut self, flags: i32) -> &mut OpenOptions {
        self.as_inner_mut().custom_flags(flags);
        self
    }
}

/// Unix-specific extensions to [`fs::Metadata`].
#[stable(feature = "metadata_ext", since = "1.1.0")]
pub trait MetadataExt {
    /// Returns the ID of the device containing the file.
    ///
    /// # Examples
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// use std::io;
    /// use std::fs;
    /// use std::os::unix::fs::MetadataExt;
    ///
    /// fn main() -> io::Result<()> {
    ///     let meta = fs::metadata("some_file")?;
    ///     let dev_id = meta.dev();
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext", since = "1.1.0")]
    fn dev(&self) -> u64;
    /// 返回 inode 编号。
    ///
    /// # 示例
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// use std::fs;
    /// use std::os::unix::fs::MetadataExt;
    /// use std::io;
    ///
    /// fn main() -> io::Result<()> {
    /// let meta = fs::metadata("some_file")?;
    /// let inode = meta.ino();
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext", since = "1.1.0")]
    fn ino(&self) -> u64;
    /// Returns the rights applied to this file.
    ///
    /// # Examples
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// use std::fs;
    /// use std::os::unix::fs::MetadataExt;
    /// use std::io;
    ///
    /// fn main() -> io::Result<()> {
    ///     let meta = fs::metadata("some_file")?;
    ///     let mode = meta.mode();
    ///     let user_has_write_access      = mode & 0o200;
    ///     let user_has_read_write_access = mode & 0o600;
    ///     let group_has_read_access      = mode & 0o040;
    ///     let others_have_exec_access    = mode & 0o001;
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext", since = "1.1.0")]
    fn mode(&self) -> u32;
    /// 返回指向此文件的硬链接数量。
    ///
    /// # 示例
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// use std::fs;
    /// use std::os::unix::fs::MetadataExt;
    /// use std::io;
    ///
    /// fn main() -> io::Result<()> {
    /// let meta = fs::metadata("some_file")?;
    /// let nb_hard_links = meta.nlink();
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext", since = "1.1.0")]
    fn nlink(&self) -> u64;
    /// Returns the user ID of the owner of this file.
    ///
    /// # Examples
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// use std::fs;
    /// use std::os::unix::fs::MetadataExt;
    /// use std::io;
    ///
    /// fn main() -> io::Result<()> {
    ///     let meta = fs::metadata("some_file")?;
    ///     let user_id = meta.uid();
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext", since = "1.1.0")]
    fn uid(&self) -> u32;
    /// 返回此文件所有者的组 ID。
    ///
    /// # 示例
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// use std::fs;
    /// use std::os::unix::fs::MetadataExt;
    /// use std::io;
    ///
    /// fn main() -> io::Result<()> {
    /// let meta = fs::metadata("some_file")?;
    /// let group_id = meta.gid();
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext", since = "1.1.0")]
    fn gid(&self) -> u32;
    /// Returns the device ID of this file (if it is a special one).
    ///
    /// # Examples
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// use std::fs;
    /// use std::os::unix::fs::MetadataExt;
    /// use std::io;
    ///
    /// fn main() -> io::Result<()> {
    ///     let meta = fs::metadata("some_file")?;
    ///     let device_id = meta.rdev();
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext", since = "1.1.0")]
    fn rdev(&self) -> u64;
    /// 返回此文件的总大小（以字节为单位）。
    ///
    /// # 示例
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// use std::fs;
    /// use std::os::unix::fs::MetadataExt;
    /// use std::io;
    ///
    /// fn main() -> io::Result<()> {
    /// let meta = fs::metadata("some_file")?;
    /// let file_size = meta.size();
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext", since = "1.1.0")]
    fn size(&self) -> u64;
    /// Returns the last access time of the file, in seconds since Unix Epoch.
    ///
    /// # Examples
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// use std::fs;
    /// use std::os::unix::fs::MetadataExt;
    /// use std::io;
    ///
    /// fn main() -> io::Result<()> {
    ///     let meta = fs::metadata("some_file")?;
    ///     let last_access_time = meta.atime();
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext", since = "1.1.0")]
    fn atime(&self) -> i64;
    /// Returns the last access time of the file, in nanoseconds since [`atime`].
    ///
    /// [`atime`]: MetadataExt::atime
    ///
    /// # 示例
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// use std::fs;
    /// use std::os::unix::fs::MetadataExt;
    /// use std::io;
    ///
    /// fn main() -> io::Result<()> {
    /// let meta = fs::metadata("some_file")?;
    /// let nano_last_access_time = meta.atime_nsec();
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext", since = "1.1.0")]
    fn atime_nsec(&self) -> i64;
    /// Returns the last modification time of the file, in seconds since Unix Epoch.
    ///
    /// # Examples
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// use std::fs;
    /// use std::os::unix::fs::MetadataExt;
    /// use std::io;
    ///
    /// fn main() -> io::Result<()> {
    ///     let meta = fs::metadata("some_file")?;
    ///     let last_modification_time = meta.mtime();
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext", since = "1.1.0")]
    fn mtime(&self) -> i64;
    /// Returns the last modification time of the file, in nanoseconds since [`mtime`].
    ///
    /// [`mtime`]: MetadataExt::mtime
    ///
    /// # 示例
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// use std::fs;
    /// use std::os::unix::fs::MetadataExt;
    /// use std::io;
    ///
    /// fn main() -> io::Result<()> {
    /// let meta = fs::metadata("some_file")?;
    /// let nano_last_modification_time = meta.mtime_nsec();
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext", since = "1.1.0")]
    fn mtime_nsec(&self) -> i64;
    /// Returns the last status change time of the file, in seconds since Unix Epoch.
    ///
    /// # Examples
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// use std::fs;
    /// use std::os::unix::fs::MetadataExt;
    /// use std::io;
    ///
    /// fn main() -> io::Result<()> {
    ///     let meta = fs::metadata("some_file")?;
    ///     let last_status_change_time = meta.ctime();
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext", since = "1.1.0")]
    fn ctime(&self) -> i64;
    /// Returns the last status change time of the file, in nanoseconds since [`ctime`].
    ///
    /// [`ctime`]: MetadataExt::ctime
    ///
    /// # 示例
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// use std::fs;
    /// use std::os::unix::fs::MetadataExt;
    /// use std::io;
    ///
    /// fn main() -> io::Result<()> {
    /// let meta = fs::metadata("some_file")?;
    /// let nano_last_status_change_time = meta.ctime_nsec();
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext", since = "1.1.0")]
    fn ctime_nsec(&self) -> i64;
    /// Returns the block size for filesystem I/O.
    ///
    /// # Examples
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// use std::fs;
    /// use std::os::unix::fs::MetadataExt;
    /// use std::io;
    ///
    /// fn main() -> io::Result<()> {
    ///     let meta = fs::metadata("some_file")?;
    ///     let block_size = meta.blksize();
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext", since = "1.1.0")]
    fn blksize(&self) -> u64;
    /// 返回文件分配的块数，以 512 字节为单位。
    ///
    /// Please note that this may be smaller than `st_size / 512` when the file has holes.
    ///
    /// # 示例
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// use std::fs;
    /// use std::os::unix::fs::MetadataExt;
    /// use std::io;
    ///
    /// fn main() -> io::Result<()> {
    /// let meta = fs::metadata("some_file")?;
    /// let blocks = meta.blocks();
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext", since = "1.1.0")]
    fn blocks(&self) -> u64;
    #[cfg(target_os = "vxworks")]
    #[stable(feature = "metadata_ext", since = "1.1.0")]
    fn attrib(&self) -> u8;
}

#[stable(feature = "metadata_ext", since = "1.1.0")]
impl MetadataExt for fs::Metadata {
    fn dev(&self) -> u64 {
        self.st_dev()
    }
    fn ino(&self) -> u64 {
        self.st_ino()
    }
    fn mode(&self) -> u32 {
        self.st_mode()
    }
    fn nlink(&self) -> u64 {
        self.st_nlink()
    }
    fn uid(&self) -> u32 {
        self.st_uid()
    }
    fn gid(&self) -> u32 {
        self.st_gid()
    }
    fn rdev(&self) -> u64 {
        self.st_rdev()
    }
    fn size(&self) -> u64 {
        self.st_size()
    }
    fn atime(&self) -> i64 {
        self.st_atime()
    }
    fn atime_nsec(&self) -> i64 {
        self.st_atime_nsec()
    }
    fn mtime(&self) -> i64 {
        self.st_mtime()
    }
    fn mtime_nsec(&self) -> i64 {
        self.st_mtime_nsec()
    }
    fn ctime(&self) -> i64 {
        self.st_ctime()
    }
    fn ctime_nsec(&self) -> i64 {
        self.st_ctime_nsec()
    }
    fn blksize(&self) -> u64 {
        self.st_blksize()
    }
    fn blocks(&self) -> u64 {
        self.st_blocks()
    }
    #[cfg(target_os = "vxworks")]
    fn attrib(&self) -> u8 {
        self.st_attrib()
    }
}

/// Unix-specific extensions for [`fs::FileType`].
///
/// Adds support for special Unix file types such as block/character devices,
/// pipes, and sockets.
#[stable(feature = "file_type_ext", since = "1.5.0")]
pub trait FileTypeExt {
    /// Returns `true` if this file type is a block device.
    ///
    /// # Examples
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// use std::fs;
    /// use std::os::unix::fs::FileTypeExt;
    /// use std::io;
    ///
    /// fn main() -> io::Result<()> {
    ///     let meta = fs::metadata("block_device_file")?;
    ///     let file_type = meta.file_type();
    ///     assert!(file_type.is_block_device());
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "file_type_ext", since = "1.5.0")]
    fn is_block_device(&self) -> bool;
    /// Returns `true` if this file type is a char device.
    ///
    /// # 示例
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// use std::fs;
    /// use std::os::unix::fs::FileTypeExt;
    /// use std::io;
    ///
    /// fn main() -> io::Result<()> {
    /// let meta = fs::metadata("char_device_file")?;
    /// let file_type = meta.file_type();
    /// assert!(file_type.is_char_device());
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "file_type_ext", since = "1.5.0")]
    fn is_char_device(&self) -> bool;
    /// Returns `true` if this file type is a fifo.
    ///
    /// # Examples
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// use std::fs;
    /// use std::os::unix::fs::FileTypeExt;
    /// use std::io;
    ///
    /// fn main() -> io::Result<()> {
    ///     let meta = fs::metadata("fifo_file")?;
    ///     let file_type = meta.file_type();
    ///     assert!(file_type.is_fifo());
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "file_type_ext", since = "1.5.0")]
    fn is_fifo(&self) -> bool;
    /// Returns `true` if this file type is a socket.
    ///
    /// # 示例
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// use std::fs;
    /// use std::os::unix::fs::FileTypeExt;
    /// use std::io;
    ///
    /// fn main() -> io::Result<()> {
    /// let meta = fs::metadata("unix.socket")?;
    /// let file_type = meta.file_type();
    /// assert!(file_type.is_socket());
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "file_type_ext", since = "1.5.0")]
    fn is_socket(&self) -> bool;
}

#[stable(feature = "file_type_ext", since = "1.5.0")]
impl FileTypeExt for fs::FileType {
    #[rustdoc_skip_body]
    fn is_block_device(&self) -> bool {
        self.as_inner().is(libc::S_IFBLK)
    }
    #[rustdoc_skip_body]
    fn is_char_device(&self) -> bool {
        self.as_inner().is(libc::S_IFCHR)
    }
    #[rustdoc_skip_body]
    fn is_fifo(&self) -> bool {
        self.as_inner().is(libc::S_IFIFO)
    }
    #[rustdoc_skip_body]
    fn is_socket(&self) -> bool {
        self.as_inner().is(libc::S_IFSOCK)
    }
}

/// Unix-specific extension methods for [`fs::DirEntry`].
#[stable(feature = "dir_entry_ext", since = "1.1.0")]
pub trait DirEntryExt {
    /// Returns the underlying `d_ino` field in the contained `dirent`
    /// structure.
    ///
    /// # Examples
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// use std::fs;
    /// use std::os::unix::fs::DirEntryExt;
    ///
    /// if let Ok(entries) = fs::read_dir(".") {
    ///     for entry in entries {
    ///         if let Ok(entry) = entry {
    ///             // Here, `entry` is a `DirEntry`.
    ///             println!("{:?}: {}", entry.file_name(), entry.ino());
    ///         }
    ///     }
    /// }
    /// ```
    #[stable(feature = "dir_entry_ext", since = "1.1.0")]
    fn ino(&self) -> u64;
}

#[stable(feature = "dir_entry_ext", since = "1.1.0")]
impl DirEntryExt for fs::DirEntry {
    #[rustdoc_skip_body]
    fn ino(&self) -> u64 {
        self.as_inner().ino()
    }
}

/// Unix-specific extension methods for [`fs::DirEntry`].
#[unstable(feature = "dir_entry_ext2", issue = "85573")]
pub impl(self) trait DirEntryExt2 {
    /// Returns a reference to the underlying `OsStr` of this entry's filename.
    ///
    /// # 示例
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// #![feature(dir_entry_ext2)]
    /// use std::os::unix::fs::DirEntryExt2;
    /// use std::{fs, io};
    ///
    /// fn main() -> io::Result<()> {
    ///     let mut entries = fs::read_dir(".")?.collect::<Result<Vec<_>, io::Error>>()?;
    /// entries.sort_unstable_by(|a, b| a.file_name_ref().cmp(b.file_name_ref()));
    ///
    /// for p in entries {
    /// println!("{p:?}");
    ///     }
    ///
    ///     Ok(())
    /// }
    /// ```
    fn file_name_ref(&self) -> &OsStr;
}

#[unstable(feature = "dir_entry_ext2", issue = "85573")]
impl DirEntryExt2 for fs::DirEntry {
    #[rustdoc_skip_body]
    fn file_name_ref(&self) -> &OsStr {
        self.as_inner().file_name_os_str()
    }
}

/// Creates a new symbolic link on the filesystem.
///
/// The `link` path will be a symbolic link pointing to the `original` path.
///
/// # Examples
///
#[cfg_attr(target_family = "unix", doc = "```no_run")]
#[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
/// use std::os::unix::fs;
///
/// fn main() -> std::io::Result<()> {
///     fs::symlink("a.txt", "b.txt")?;
///     Ok(())
/// }
/// ```
#[stable(feature = "symlink", since = "1.1.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "fs_symlink")]
pub fn symlink<P: AsRef<Path>, Q: AsRef<Path>>(original: P, link: Q) -> io::Result<()> {
    sys::fs::symlink(original.as_ref(), link.as_ref())
}

/// Unix-specific extensions to [`fs::DirBuilder`].
#[stable(feature = "dir_builder", since = "1.6.0")]
pub trait DirBuilderExt {
    /// 设置创建新目录的模式。此选项默认值为
    /// 0o777.
    ///
    /// # 示例
    ///
    #[cfg_attr(target_family = "unix", doc = "```no_run")]
    #[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
    /// use std::fs::DirBuilder;
    /// use std::os::unix::fs::DirBuilderExt;
    ///
    /// let mut builder = DirBuilder::new();
    /// builder.mode(0o755);
    /// ```
    #[stable(feature = "dir_builder", since = "1.6.0")]
    fn mode(&mut self, mode: u32) -> &mut Self;
}

#[stable(feature = "dir_builder", since = "1.6.0")]
impl DirBuilderExt for fs::DirBuilder {
    #[rustdoc_skip_body]
    fn mode(&mut self, mode: u32) -> &mut fs::DirBuilder {
        self.as_inner_mut().set_mode(mode);
        self
    }
}

/// Change the owner and group of the specified path.
///
/// Specifying either the uid or gid as `None` will leave it unchanged.
///
/// Changing the owner typically requires privileges, such as root or a specific capability.
/// Changing the group typically requires either being the owner and a member of the group, or
/// having privileges.
///
/// Be aware that changing owner clears the `suid` and `sgid` permission bits in most cases
/// according to POSIX, usually even if the user is root. The sgid is not cleared when
/// the file is non-group-executable. See: <https://www.man7.org/linux/man-pages/man2/chown.2.html>
/// This call may also clear file capabilities, if there was any.
///
/// If called on a symbolic link, this will change the owner and group of the link target. To
/// change the owner and group of the link itself, see [`lchown`].
///
/// # Examples
///
#[cfg_attr(target_family = "unix", doc = "```no_run")]
#[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
/// use std::os::unix::fs;
///
/// fn main() -> std::io::Result<()> {
///     fs::chown("/sandbox", Some(0), Some(0))?;
///     Ok(())
/// }
/// ```
#[stable(feature = "unix_chown", since = "1.73.0")]
#[rustdoc_skip_body]
pub fn chown<P: AsRef<Path>>(dir: P, uid: Option<u32>, gid: Option<u32>) -> io::Result<()> {
    sys::fs::chown(dir.as_ref(), uid.unwrap_or(u32::MAX), gid.unwrap_or(u32::MAX))
}

/// 更改指定打开文件描述符所引用的文件的所有者和组。
///
/// For semantics and required privileges, see [`chown`].
///
/// # 示例
///
#[cfg_attr(target_family = "unix", doc = "```no_run")]
#[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
/// use std::os::unix::fs;
///
/// fn main() -> std::io::Result<()> {
/// let f = std::fs::File::open("/file")?;
/// fs::fchown(&f, Some(0), Some(0))?;
///     Ok(())
/// }
/// ```
#[stable(feature = "unix_chown", since = "1.73.0")]
#[rustdoc_skip_body]
pub fn fchown<F: AsFd>(fd: F, uid: Option<u32>, gid: Option<u32>) -> io::Result<()> {
    sys::fs::fchown(fd.as_fd().as_raw_fd(), uid.unwrap_or(u32::MAX), gid.unwrap_or(u32::MAX))
}

/// Change the owner and group of the specified path, without dereferencing symbolic links.
///
/// Identical to [`chown`], except that if called on a symbolic link, this will change the owner
/// and group of the link itself rather than the owner and group of the link target.
///
/// # Examples
///
#[cfg_attr(target_family = "unix", doc = "```no_run")]
#[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
/// use std::os::unix::fs;
///
/// fn main() -> std::io::Result<()> {
///     fs::lchown("/symlink", Some(0), Some(0))?;
///     Ok(())
/// }
/// ```
#[stable(feature = "unix_chown", since = "1.73.0")]
#[rustdoc_skip_body]
pub fn lchown<P: AsRef<Path>>(dir: P, uid: Option<u32>, gid: Option<u32>) -> io::Result<()> {
    sys::fs::lchown(dir.as_ref(), uid.unwrap_or(u32::MAX), gid.unwrap_or(u32::MAX))
}

/// 将当前进程的根目录更改为指定路径。
///
/// 这通常需要根权限或特定能力。
///
/// 这不会改变当前工作目录；您应该调用
/// [`std::env::set_current_dir`][`crate::env::set_current_dir`] afterwards.
///
/// # 示例
///
#[cfg_attr(target_family = "unix", doc = "```no_run")]
#[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
/// use std::os::unix::fs;
///
/// fn main() -> std::io::Result<()> {
/// fs::chroot("/sandbox")?;
/// std::env::set_current_dir("/")?;
/// // 在沙箱环境中继续工作
///     Ok(())
/// }
/// ```
#[stable(feature = "unix_chroot", since = "1.56.0")]
#[cfg(not(target_os = "fuchsia"))]
#[rustdoc_skip_body]
pub fn chroot<P: AsRef<Path>>(dir: P) -> io::Result<()> {
    sys::fs::chroot(dir.as_ref())
}

/// Create a FIFO special file at the specified path with the specified mode.
///
/// # Examples
///
#[cfg_attr(target_family = "unix", doc = "```no_run")]
#[cfg_attr(not(target_family = "unix"), doc = "```ignore (needs unix)")]
/// # #![feature(unix_mkfifo)]
/// # #[cfg(not(unix))]
/// # fn main() {}
/// # #[cfg(unix)]
/// # fn main() -> std::io::Result<()> {
/// # use std::{
/// #     os::unix::fs::{mkfifo, PermissionsExt},
/// #     fs::{File, Permissions, remove_file},
/// #     io::{Write, Read},
/// # };
/// # let _ = remove_file("/tmp/fifo");
/// mkfifo("/tmp/fifo", Permissions::from_mode(0o774))?;
///
/// let mut wx = File::options().read(true).write(true).open("/tmp/fifo")?;
/// let mut rx = File::open("/tmp/fifo")?;
///
/// wx.write_all(b"hello, world!")?;
/// drop(wx);
///
/// let mut s = String::new();
/// rx.read_to_string(&mut s)?;
///
/// assert_eq!(s, "hello, world!");
/// # Ok(())
/// # }
/// ```
#[unstable(feature = "unix_mkfifo", issue = "139324")]
#[rustdoc_skip_body]
pub fn mkfifo<P: AsRef<Path>>(path: P, permissions: Permissions) -> io::Result<()> {
    sys::fs::mkfifo(path.as_ref(), permissions.mode())
}
