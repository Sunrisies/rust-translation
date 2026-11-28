//! Windows-specific extensions to primitives in the [`std::fs`] module.
//!
//! [`std::fs`]: crate::fs

#![stable(feature = "rust1", since = "1.0.0")]

use crate::fs::{self, Metadata, OpenOptions, Permissions};
use crate::io::BorrowedCursor;
use crate::macros::rustdoc_skip_body;
use crate::path::Path;
use crate::sys::{AsInner, AsInnerMut, FromInner, IntoInner};
use crate::time::SystemTime;
use crate::{io, sys};

mod dirs;

#[unstable(feature = "fs_home_dirs", issue = "162082")]
pub use dirs::HomeDirsExt;
#[unstable(feature = "fs_media_dirs", issue = "162083")]
pub use dirs::MediaDirsExt;

/// Windows-specific extensions to [`fs::File`].
#[stable(feature = "file_offset", since = "1.15.0")]
pub trait FileExt {
    /// 定位到特定位置并读取指定数量的字节。
    ///
    /// 返回读取的字节数。
    ///
    /// 偏移量相对于文件起始位置，因此与当前光标无关。当前光标**受此影响**。
    /// from the current cursor. The current cursor **is** affected by this
    /// 该函数将文件指针设置为读取的末尾。
    ///
    /// 读取文件末尾之后的内容总是会返回长度为 0 的结果。
    /// 0\.
    ///
    /// Note that similar to `File::read`, it is not an error to return with a
    /// 从这种短读取中返回时，文件指针仍然会被更新。
    /// # 示例
    ///
    /// # 示例
    ///
    #[cfg_attr(windows, doc = "```no_run")]
    #[cfg_attr(not(windows), doc = "```ignore (needs windows)")]
    /// use std::io;
    /// use std::fs::File;
    /// use std::os::windows::prelude::*;
    ///
    /// fn main() -> io::Result<()> {
    /// let mut file = File::open("foo.txt")?;
    /// let mut buffer = [0; 10];
    ///
    /// // 从文件开头第 72 个字节处读取 10 个字节。
    /// // 起始位置。
    /// file.seek_read(&mut buffer[..], 72)?;
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "file_offset", since = "1.15.0")]
    fn seek_read(&self, buf: &mut [u8], offset: u64) -> io::Result<usize>;

    /// Seeks to a given position and reads the exact number of bytes required to fill `buf`.
    ///
    /// The offset is relative to the start of the file and thus independent
    /// from the current cursor. The current cursor **is** affected by this
    /// function, it is set to the end of the read.
    ///
    /// Similar to [`io::Read::read_exact`] but uses [`seek_read`] instead of `read`.
    ///
    /// [`seek_read`]: FileExt::seek_read
    ///
    /// # Errors
    ///
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
    #[cfg_attr(windows, doc = "```no_run")]
    #[cfg_attr(not(windows), doc = "```ignore (needs windows)")]
    /// #![feature(seek_read_exact_seek_write_all)]
    ///
    /// use std::io;
    /// use std::fs::File;
    /// use std::os::windows::prelude::*;
    ///
    /// fn main() -> io::Result<()> {
    ///     let mut file = File::open("foo.txt")?;
    ///     let mut buffer = [0; 10];
    ///
    ///     // Read 10 bytes, starting 72 bytes from the
    ///     // start of the file.
    ///     file.seek_read_exact(&mut buffer[..], 72)?;
    ///     Ok(())
    /// }
    /// ```
    #[unstable(feature = "seek_read_exact_seek_write_all", issue = "162868")]
    fn seek_read_exact(&self, mut buf: &mut [u8], mut offset: u64) -> io::Result<()> {
        while !buf.is_empty() {
            match self.seek_read(buf, offset) {
                Ok(0) => break,
                Ok(n) => {
                    buf = &mut buf[n..];
                    offset += n as u64;
                }
                Err(e) => return Err(e),
            }
        }
        if !buf.is_empty() { Err(io::Error::READ_EXACT_EOF) } else { Ok(()) }
    }

    /// 定位到特定位置并将部分字节写入缓冲区。
    ///
    /// This is equivalent to the [`seek_read`](FileExt::seek_read) method, except that it is passed
    /// a [`BorrowedCursor`] rather than `&mut [u8]` to allow use with uninitialized buffers. The
    /// new data will be appended to any existing contents of `buf`.
    ///
    /// use std::io;
    ///
    /// # use std::io::BorrowedBuf;
    ///
    #[cfg_attr(windows, doc = "```no_run")]
    #[cfg_attr(not(windows), doc = "```ignore (needs windows)")]
    /// #![feature(core_io_borrowed_buf)]
    /// #![feature(read_buf_at)]
    ///
    /// use std::fs::File;
    /// use std::mem::MaybeUninit;
    /// use std::os::windows::prelude::*;
    /// use std::mem::MaybeUninit;
    /// let mut file = File::open("pi.txt")?;
    ///
    /// fn main() -> io::Result<()> {
    ///     let mut file = File::open("pi.txt")?;
    ///
    /// let mut buf = BorrowedBuf::from(buf.as_mut_slice());
    ///     let mut buf: [MaybeUninit<u8>; 10] = [MaybeUninit::uninit(); 10];
    /// assert!(buf.filled().starts_with(b"1"));
    /// 定位到特定位置并写入指定数量的字节。
    ///
    /// 返回写入的字节数。
    ///
    ///     Ok(())
    /// }
    /// ```
    #[unstable(feature = "read_buf_at", issue = "140771")]
    fn seek_read_buf(&self, buf: BorrowedCursor<'_, u8>, offset: u64) -> io::Result<()> {
        io::default_read_buf(|b| self.seek_read(b, offset), buf)
    }

    /// Seeks to a given position and reads the exact number of bytes required to fill `buf`.
    ///
    /// This is equivalent to the [`seek_read_exact`](FileExt::seek_read_exact) method, except
    /// that it is passed a [`BorrowedCursor`] rather than `&mut [u8]` to allow use with
    /// uninitialized buffers. The new data will be appended to any existing contents of `buf`.
    ///
    /// Reading beyond the end of the file will always succeed without reading any bytes.
    ///
    /// # Examples
    ///
    #[cfg_attr(windows, doc = "```no_run")]
    #[cfg_attr(not(windows), doc = "```ignore (needs windows)")]
    /// #![feature(core_io_borrowed_buf)]
    /// #![feature(seek_read_exact_seek_write_all)]
    ///
    /// use std::io;
    /// use std::io::BorrowedBuf;
    /// use std::fs::File;
    /// use std::mem::MaybeUninit;
    /// use std::os::windows::prelude::*;
    ///
    /// fn main() -> io::Result<()> {
    ///     let mut file = File::open("pi.txt")?;
    ///
    ///     // Read some bytes starting from offset 2
    ///     let mut buf: [MaybeUninit<u8>; 10] = [MaybeUninit::uninit(); 10];
    ///     let mut buf = BorrowedBuf::from(buf.as_mut_slice());
    ///     file.seek_read_buf_exact(buf.unfilled(), 2)?;
    ///
    ///     assert!(buf.filled().starts_with(b"1"));
    ///
    ///     Ok(())
    /// }
    /// ```
    #[unstable(feature = "seek_read_exact_seek_write_all", issue = "162868")]
    fn seek_read_buf_exact(
        &self,
        mut buf: BorrowedCursor<'_, u8>,
        mut offset: u64,
    ) -> io::Result<()> {
        while buf.capacity() > 0 {
            let prev_written = buf.written();
            match self.seek_read_buf(buf.reborrow(), offset) {
                Ok(()) => {}
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

    /// 偏移量相对于文件起始位置，因此与当前光标无关。当前光标**受此影响**。
    ///
    /// 该函数将文件指针设置为写入的末尾。
    ///
    /// The offset is relative to the start of the file and thus independent
    /// 当在文件末尾之后写入时，文件会被适当扩展，中间字节被设置为零。
    /// function, it is set to the end of the write.
    ///
    /// If the file was opened for appending (via [`OpenOptions::append`]), this is equivalent
    /// to `write`: the `offset` is ignored, and `buf` is appended at the end of the file.
    ///
    /// When writing beyond the end of the file, the file is appropriately
    /// extended and the intermediate bytes are set to zero.
    ///
    /// Note that similar to `File::write`, it is not an error to return a
    /// 在进行此类短写入后返回时，文件指针
    /// 仍然会被更新。
    ///
    /// # 示例
    ///
    #[cfg_attr(windows, doc = "```no_run")]
    #[cfg_attr(not(windows), doc = "```ignore (needs windows)")]
    /// use std::fs::File;
    /// use std::os::windows::prelude::*;
    ///
    /// fn main() -> std::io::Result<()> {
    /// let mut buffer = File::create("foo.txt")?;
    ///
    /// // 从文件开始72字节处写入一个字节字符串
    /// // 即文件的起始位置。
    /// buffer.seek_write(b"some bytes", 72)?;
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "file_offset", since = "1.15.0")]
    fn seek_write(&self, buf: &[u8], offset: u64) -> io::Result<usize>;

    /// Seeks to a given position and attempts to write an entire buffer.
    ///
    /// The offset is relative to the start of the file and thus independent
    /// from the current cursor. The current cursor **is** affected by this
    /// function, it is set to the end of the write.
    ///
    /// This method will continuously call [`seek_write`] until there is no more data
    /// to be written or an error of non-[`io::ErrorKind::Interrupted`] kind is
    /// returned. This method will not return until the entire buffer has been
    /// successfully written or such an error occurs. The first error that is
    /// not of [`io::ErrorKind::Interrupted`] kind generated from this method will be
    /// returned.
    ///
    /// # Errors
    ///
    /// This function will return the first error that [`seek_write`] returns.
    ///
    /// [`seek_write`]: FileExt::seek_write
    ///
    /// # Examples
    ///
    #[cfg_attr(windows, doc = "```no_run")]
    #[cfg_attr(not(windows), doc = "```ignore (needs windows)")]
    /// #![feature(seek_read_exact_seek_write_all)]
    ///
    /// use std::fs::File;
    /// use std::os::windows::prelude::*;
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let mut buffer = File::create("foo.txt")?;
    ///
    ///     // Write a byte string starting 72 bytes from
    ///     // the start of the file.
    ///     buffer.seek_write_all(b"some bytes", 72)?;
    ///     Ok(())
    /// }
    /// ```
    #[unstable(feature = "seek_read_exact_seek_write_all", issue = "162868")]
    fn seek_write_all(&self, mut buf: &[u8], mut offset: u64) -> io::Result<()> {
        while !buf.is_empty() {
            match self.seek_write(buf, offset) {
                Ok(0) => {
                    return Err(io::Error::WRITE_ALL_EOF);
                }
                Ok(n) => {
                    buf = &buf[n..];
                    offset += n as u64
                }
                Err(e) => return Err(e),
            }
        }
        Ok(())
    }
}

#[stable(feature = "file_offset", since = "1.15.0")]
impl FileExt for fs::File {
    fn seek_read(&self, buf: &mut [u8], offset: u64) -> io::Result<usize> {
        self.as_inner().read_at(buf, offset)
    }

    fn seek_read_buf(&self, buf: BorrowedCursor<'_, u8>, offset: u64) -> io::Result<()> {
        self.as_inner().read_buf_at(buf, offset)
    }

    fn seek_write(&self, buf: &[u8], offset: u64) -> io::Result<usize> {
        self.as_inner().write_at(buf, offset)
    }
}

/// Windows-specific extensions to [`fs::OpenOptions`].
// WARNING: This trait is not sealed. DON'T add any new methods!
// Add them to OpenOptionsExt2 instead.
#[stable(feature = "open_options_ext", since = "1.10.0")]
pub trait OpenOptionsExt {
    /// Overrides the `dwDesiredAccess` argument to the call to [`CreateFile`]
    /// with the specified value.
    ///
    /// This will override the `read`, `write`, and `append` flags on the
    /// `OpenOptions` structure. This method provides fine-grained control over
    /// # 示例
    /// use std::fs::OpenOptions;
    ///
    /// # use std::os::windows::prelude::*;
    ///
    #[cfg_attr(windows, doc = "```no_run")]
    #[cfg_attr(not(windows), doc = "```ignore (needs windows)")]
    /// // 以无读取和写入权限的方式打开，例如仅需要
    /// use std::os::windows::prelude::*;
    ///
    /// let file = OpenOptions::new().access_mode(0).open("foo.txt");
    /// // to call `stat` on the file
    /// let file = OpenOptions::new().access_mode(0).open("foo.txt");
    /// ```
    ///
    /// [`CreateFile`]: https://docs.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilea
    #[stable(feature = "open_options_ext", since = "1.10.0")]
    fn access_mode(&mut self, access: u32) -> &mut Self;

    /// Overrides the `dwShareMode` argument to the call to [`CreateFile`] with
    /// the specified value.
    ///
    /// By default `share_mode` is set to
    /// `FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE`. This allows
    /// other processes to read, write, and delete/rename the same file
    /// while it is open. Removing any of the flags will prevent other
    /// processes from performing the corresponding operation until the file
    /// handle is closed.
    ///
    /// # Examples
    ///
    #[cfg_attr(windows, doc = "```no_run")]
    #[cfg_attr(not(windows), doc = "```ignore (needs windows)")]
    /// use std::fs::OpenOptions;
    /// use std::os::windows::prelude::*;
    ///
    /// // Do not allow others to read or modify this file while we have it open
    /// // for writing.
    /// let file = OpenOptions::new()
    ///     .write(true)
    ///     .share_mode(0)
    ///     .open("foo.txt");
    /// ```
    ///
    /// [`CreateFile`]: https://docs.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilea
    #[stable(feature = "open_options_ext", since = "1.10.0")]
    fn share_mode(&mut self, val: u32) -> &mut Self;

    /// Sets extra flags for the `dwFileFlags` argument to the call to
    /// [`CreateFile2`] to the specified value (or combines it with
    /// `attributes` and `security_qos_flags` to set the `dwFlagsAndAttributes`
    /// for [`CreateFile`]).
    ///
    /// # 示例
    /// # #![allow(unexpected_cfgs)]
    ///
    /// # 示例
    ///
    #[cfg_attr(windows, doc = "```no_run")]
    #[cfg_attr(not(windows), doc = "```ignore (needs windows)")]
    /// # #![allow(unexpected_cfgs)]
    /// use std::fs::OpenOptions;
    /// use std::os::windows::prelude::*;
    ///
    /// # pub const FILE_FLAG_DELETE_ON_CLOSE: u32 = 0x04000000;
    ///
    /// let file = OpenOptions::new()
    /// .create(true)
    /// .write(true)
    /// .custom_flags(FILE_FLAG_DELETE_ON_CLOSE)
    /// .open("foo.txt");
    /// ```
    ///
    /// [`CreateFile`]: https://docs.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilea
    /// [`CreateFile2`]: https://docs.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfile2
    #[stable(feature = "open_options_ext", since = "1.10.0")]
    fn custom_flags(&mut self, flags: u32) -> &mut Self;

    /// Sets the `dwFileAttributes` argument to the call to [`CreateFile2`] to
    /// the specified value (or combines it with `custom_flags` and
    /// `security_qos_flags` to set the `dwFlagsAndAttributes` for
    /// [`CreateFile`]).
    ///
    /// If a _new_ file is created because it does not yet exist and
    /// `.create(true)` or `.create_new(true)` are specified, the new file is
    /// given the attributes declared with `.attributes()`.
    ///
    /// If an _existing_ file is opened with `.create(true).truncate(true)`, its
    /// existing attributes are preserved and combined with the ones declared
    /// with `.attributes()`.
    ///
    /// In all other cases the attributes get ignored.
    ///
    /// # Examples
    ///
    #[cfg_attr(windows, doc = "```no_run")]
    #[cfg_attr(not(windows), doc = "```ignore (needs windows)")]
    /// # #![allow(unexpected_cfgs)]
    /// use std::fs::OpenOptions;
    /// use std::os::windows::prelude::*;
    ///
    /// # pub const FILE_ATTRIBUTE_HIDDEN: u32 = 2;
    ///
    /// let file = OpenOptions::new()
    ///     .write(true)
    ///     .create(true)
    ///     .attributes(FILE_ATTRIBUTE_HIDDEN)
    ///     .open("foo.txt");
    /// ```
    ///
    /// [`CreateFile`]: https://docs.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilea
    /// [`CreateFile2`]: https://docs.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfile2
    #[stable(feature = "open_options_ext", since = "1.10.0")]
    fn attributes(&mut self, val: u32) -> &mut Self;

    /// Sets the `dwSecurityQosFlags` argument to the call to [`CreateFile2`] to
    /// the specified value (or combines it with `custom_flags` and `attributes`
    /// to set the `dwFlagsAndAttributes` for [`CreateFile`]).
    ///
    /// By default `security_qos_flags` is not set. It should be specified when
    /// opening a named pipe, to control to which degree a server process can
    /// 特权 Rust 进程的权限。因此
    ///
    /// When `security_qos_flags` is not set, a malicious program can gain the
    /// 特权 Rust 进程的权限，从而在允许打开用户指定的路径时实施
    /// 此行为。因此
    /// arguably `security_qos_flags` should also be set when opening arbitrary
    /// paths. However the bits can then conflict with other flags, specifically
    /// `FILE_FLAG_OPEN_NO_RECALL`.
    ///
    /// 有关可能的值信息，请参见 Windows Dev Center 上的 [Impersonation Levels]。
    /// Windows Dev Center site. The `SECURITY_SQOS_PRESENT` flag is set
    /// [##3] 示例
    ///
    /// # Examples
    ///
    #[cfg_attr(windows, doc = "```no_run")]
    #[cfg_attr(not(windows), doc = "```ignore (needs windows)")]
    /// # #![allow(unexpected_cfgs)]
    /// use std::fs::OpenOptions;
    /// use std::os::windows::prelude::*;
    ///
    /// # pub const SECURITY_IDENTIFICATION: u32 = 0;
    ///
    /// let file = OpenOptions::new()
    /// .write(true)
    /// .create(true)
    /// .security_qos_flags(SECURITY_IDENTIFICATION)
    /// .open(r"\\.\pipe\MyPipe");
    /// ```
    ///
    /// [`CreateFile`]: https://docs.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilea
    /// [`CreateFile2`]: https://docs.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfile2
    /// [Impersonation Levels]:
    ///     https://docs.microsoft.com/en-us/windows/win32/api/winnt/ne-winnt-security_impersonation_level
    #[stable(feature = "open_options_ext", since = "1.10.0")]
    fn security_qos_flags(&mut self, flags: u32) -> &mut Self;
}

#[stable(feature = "open_options_ext", since = "1.10.0")]
impl OpenOptionsExt for OpenOptions {
    #[rustdoc_skip_body]
    fn access_mode(&mut self, access: u32) -> &mut OpenOptions {
        self.as_inner_mut().access_mode(access);
        self
    }

    #[rustdoc_skip_body]
    fn share_mode(&mut self, share: u32) -> &mut OpenOptions {
        self.as_inner_mut().share_mode(share);
        self
    }

    #[rustdoc_skip_body]
    fn custom_flags(&mut self, flags: u32) -> &mut OpenOptions {
        self.as_inner_mut().custom_flags(flags);
        self
    }

    #[rustdoc_skip_body]
    fn attributes(&mut self, attributes: u32) -> &mut OpenOptions {
        self.as_inner_mut().attributes(attributes);
        self
    }

    #[rustdoc_skip_body]
    fn security_qos_flags(&mut self, flags: u32) -> &mut OpenOptions {
        self.as_inner_mut().security_qos_flags(flags);
        self
    }
}

#[unstable(feature = "windows_freeze_file_times", issue = "149715")]
pub impl(self) trait OpenOptionsExt2 {
    /// If set to `true`, prevent the "last access time" of the file from being changed.
    ///
    /// Default to `false`.
    #[unstable(feature = "windows_freeze_file_times", issue = "149715")]
    fn freeze_last_access_time(&mut self, freeze: bool) -> &mut Self;

    /// If set to `true`, prevent the "last write time" of the file from being changed.
    ///
    /// Default to `false`.
    #[unstable(feature = "windows_freeze_file_times", issue = "149715")]
    fn freeze_last_write_time(&mut self, freeze: bool) -> &mut Self;
}

#[unstable(feature = "windows_freeze_file_times", issue = "149715")]
impl OpenOptionsExt2 for OpenOptions {
    #[rustdoc_skip_body]
    fn freeze_last_access_time(&mut self, freeze: bool) -> &mut Self {
        self.as_inner_mut().freeze_last_access_time(freeze);
        self
    }

    #[rustdoc_skip_body]
    fn freeze_last_write_time(&mut self, freeze: bool) -> &mut Self {
        self.as_inner_mut().freeze_last_write_time(freeze);
        self
    }
}

/// Windows-specific extensions to [`fs::Permissions`]. This extension trait
/// provides extra utilities to shows what Windows file attributes are enabled
/// in [`Permissions`] and to manually set file attributes on [`Permissions`].
///
/// See Microsoft's [`File Attribute Constants`] page to know what file
/// attribute metadata are defined and stored on Windows files.
///
/// [`Permissions`]: fs::Permissions
/// [`File Attribute Constants`]:
///     https://learn.microsoft.com/en-us/windows/win32/fileio/file-attribute-constants
///
/// # Example
///
#[cfg_attr(windows, doc = "```no_run")]
#[cfg_attr(not(windows), doc = "```ignore (needs windows)")]
/// #![feature(windows_permissions_ext)]
/// use std::fs::Permissions;
/// use std::os::windows::fs::PermissionsExt;
///
/// const FILE_ATTRIBUTE_SYSTEM: u32 = 0x4;
/// const FILE_ATTRIBUTE_ARCHIVE: u32 = 0x20;
/// let my_file_attr = FILE_ATTRIBUTE_SYSTEM | FILE_ATTRIBUTE_ARCHIVE;
/// let mut permissions = Permissions::from_file_attributes(my_file_attr);
/// assert_eq!(permissions.file_attributes(), my_file_attr);
///
/// const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
/// let new_file_attr = permissions.file_attributes() | FILE_ATTRIBUTE_HIDDEN;
/// permissions.set_file_attributes(new_file_attr);
/// assert_eq!(permissions.file_attributes(), new_file_attr);
/// ```
#[unstable(feature = "windows_permissions_ext", issue = "152956")]
pub impl(self) trait PermissionsExt {
    /// 返回文件属性位。
    #[unstable(feature = "windows_permissions_ext", issue = "152956")]
    fn file_attributes(&self) -> u32;

    /// 设置文件属性位。
    #[unstable(feature = "windows_permissions_ext", issue = "152956")]
    fn set_file_attributes(&mut self, mask: u32);

    /// 根据给定的文件属性位创建新实例。
    #[unstable(feature = "windows_permissions_ext", issue = "152956")]
    fn from_file_attributes(mask: u32) -> Self;
}

#[unstable(feature = "windows_permissions_ext", issue = "152956")]
impl PermissionsExt for fs::Permissions {
    #[rustdoc_skip_body]
    fn file_attributes(&self) -> u32 {
        self.as_inner().file_attributes()
    }

    fn set_file_attributes(&mut self, mask: u32) {
        *self = Permissions::from_inner(FromInner::from_inner(mask));
    }

    fn from_file_attributes(mask: u32) -> Self {
        Permissions::from_inner(FromInner::from_inner(mask))
    }
}

/// Windows-specific extensions to [`fs::Metadata`].
///
/// 此 trait 暴露的数据成员与 [<<#0>>] 结构中的成员相对应。
/// of the [`BY_HANDLE_FILE_INFORMATION`] structure.
///
/// [`BY_HANDLE_FILE_INFORMATION`]:
/// 返回此元数据的 <<#0>> 字段的值。
#[stable(feature = "metadata_ext", since = "1.1.0")]
pub trait MetadataExt {
    /// Returns the value of the `dwFileAttributes` field of this metadata.
    ///
    /// Windows Dev Center 中的 [File Attribute Constants]。
    /// # 示例
    /// use std::io;
    ///
    /// # use std::fs;
    ///
    #[cfg_attr(windows, doc = "```no_run")]
    #[cfg_attr(not(windows), doc = "```ignore (needs windows)")]
    /// use std::os::windows::prelude::*;
    /// use std::io;
    /// use std::os::windows::prelude::*;
    ///
    /// fn main() -> io::Result<()> {
    /// let metadata = fs::metadata("foo.txt")?;
    /// let attributes = metadata.file_attributes();
    ///     Ok(())
    /// }
    /// ```
    ///
    /// [File Attribute Constants]:
    ///     https://docs.microsoft.com/windows/win32/fileio/file-attribute-constants
    #[stable(feature = "metadata_ext", since = "1.1.0")]
    fn file_attributes(&self) -> u32;

    /// Returns the value of the `ftCreationTime` field of this metadata.
    ///
    /// The returned 64-bit value is equivalent to a [`FILETIME`] struct,
    /// which represents the number of 100-nanosecond intervals since
    /// January 1, 1601 (UTC). The struct is automatically
    /// converted to a `u64` value, as that is the recommended way
    /// to use it.
    ///
    /// If the underlying filesystem does not support creation time, the
    /// returned value is 0.
    ///
    /// # Examples
    ///
    #[cfg_attr(windows, doc = "```no_run")]
    #[cfg_attr(not(windows), doc = "```ignore (needs windows)")]
    /// use std::io;
    /// use std::fs;
    /// use std::os::windows::prelude::*;
    ///
    /// fn main() -> io::Result<()> {
    ///     let metadata = fs::metadata("foo.txt")?;
    ///     let creation_time = metadata.creation_time();
    ///     Ok(())
    /// }
    /// ```
    ///
    /// [`FILETIME`]: https://docs.microsoft.com/windows/win32/api/minwinbase/ns-minwinbase-filetime
    #[stable(feature = "metadata_ext", since = "1.1.0")]
    fn creation_time(&self) -> u64;

    /// Returns the value of the `ftLastAccessTime` field of this metadata.
    ///
    /// The returned 64-bit value is equivalent to a [`FILETIME`] struct,
    /// 该结构表示自
    /// 1601年1月1日（UTC）以来经过的100纳秒间隔的数量。该结构会自动
    /// converted to a `u64` value, as that is the recommended way
    /// 对于文件，该值指定了上次读取或写入的时间。对于目录，该值指定了
    ///
    /// 目录创建的时间。对于文件和目录，指定的日期是正确的，但时间总是设置为
    /// 午夜。
    /// 如果底层文件系统不支持最后访问时间，则返回值为 0。
    /// # 示例
    /// use std::io;
    ///
    /// use std::fs;
    /// use std::os::windows::prelude::*;
    ///
    /// # use std::io;
    ///
    #[cfg_attr(windows, doc = "```no_run")]
    #[cfg_attr(not(windows), doc = "```ignore (needs windows)")]
    /// use std::io;
    /// use std::fs;
    /// use std::os::windows::prelude::*;
    ///
    /// fn main() -> io::Result<()> {
    /// let metadata = fs::metadata("foo.txt")?;
    /// let last_access_time = metadata.last_access_time();
    ///     Ok(())
    /// }
    /// ```
    ///
    /// [`FILETIME`]: https://docs.microsoft.com/windows/win32/api/minwinbase/ns-minwinbase-filetime
    #[stable(feature = "metadata_ext", since = "1.1.0")]
    fn last_access_time(&self) -> u64;

    /// Returns the value of the `ftLastWriteTime` field of this metadata.
    ///
    /// The returned 64-bit value is equivalent to a [`FILETIME`] struct,
    /// which represents the number of 100-nanosecond intervals since
    /// January 1, 1601 (UTC). The struct is automatically
    /// converted to a `u64` value, as that is the recommended way
    /// to use it.
    ///
    /// For a file, the value specifies the last time that a file was written
    /// to. For a directory, the structure specifies when the directory was
    /// created.
    ///
    /// If the underlying filesystem does not support the last write time,
    /// the returned value is 0.
    ///
    /// # Examples
    ///
    #[cfg_attr(windows, doc = "```no_run")]
    #[cfg_attr(not(windows), doc = "```ignore (needs windows)")]
    /// use std::io;
    /// use std::fs;
    /// use std::os::windows::prelude::*;
    ///
    /// fn main() -> io::Result<()> {
    ///     let metadata = fs::metadata("foo.txt")?;
    ///     let last_write_time = metadata.last_write_time();
    ///     Ok(())
    /// }
    /// ```
    ///
    /// [`FILETIME`]: https://docs.microsoft.com/windows/win32/api/minwinbase/ns-minwinbase-filetime
    #[stable(feature = "metadata_ext", since = "1.1.0")]
    fn last_write_time(&self) -> u64;

    /// Returns the value of the `nFileSize` fields of this
    /// 
    ///
    /// 返回值对目录没有意义。
    ///
    /// # 示例
    ///
    #[cfg_attr(windows, doc = "```no_run")]
    #[cfg_attr(not(windows), doc = "```ignore (needs windows)")]
    /// use std::io;
    /// 使用 std::fs;
    /// 使用 std::os::windows::prelude::*;
    ///
    /// fn main() -> io::Result<()> {
    /// let metadata = fs::metadata("foo.txt")?;
    /// let file_size = metadata.file_size();
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext", since = "1.1.0")]
    fn file_size(&self) -> u64;

    /// Returns the value of the `dwVolumeSerialNumber` field of this
    /// metadata.
    ///
    /// This will return `None` if the `Metadata` instance was created from a
    /// call to `DirEntry::metadata`. If this `Metadata` was created by using
    /// `fs::metadata` or `File::metadata`, then this will return `Some`.
    #[unstable(feature = "windows_by_handle", issue = "63010")]
    fn volume_serial_number(&self) -> Option<u32>;

    /// Returns the value of the `nNumberOfLinks` field of this
    /// metadata.
    ///
    /// This will return `None` if the `Metadata` instance was created from a
    /// call to `DirEntry::metadata`. If this `Metadata` was created by using
    /// `fs::metadata` or `File::metadata`, then this will return `Some`.
    #[unstable(feature = "windows_by_handle", issue = "63010")]
    fn number_of_links(&self) -> Option<u32>;

    /// Returns the value of the `nFileIndex` fields of this
    /// metadata.
    ///
    /// This will return `None` if the `Metadata` instance was created from a
    /// call to `DirEntry::metadata`. If this `Metadata` was created by using
    /// `fs::metadata` or `File::metadata`, then this will return `Some`.
    #[unstable(feature = "windows_by_handle", issue = "63010")]
    fn file_index(&self) -> Option<u64>;

    /// Returns the value of the `ChangeTime` fields of this metadata.
    ///
    /// `ChangeTime` is the last time file metadata was changed, such as
    /// renames, attributes, etc.
    ///
    /// This will return `None` if `Metadata` instance was created from a call to
    /// `DirEntry::metadata` or if the `target_vendor` is outside the current platform
    /// support for this api.
    #[unstable(feature = "windows_change_time", issue = "121478")]
    fn change_time(&self) -> Option<u64>;
}

#[stable(feature = "metadata_ext", since = "1.1.0")]
impl MetadataExt for Metadata {
    #[rustdoc_skip_body]
    fn file_attributes(&self) -> u32 {
        self.as_inner().attrs()
    }
    #[rustdoc_skip_body]
    fn creation_time(&self) -> u64 {
        self.as_inner().created_u64()
    }
    #[rustdoc_skip_body]
    fn last_access_time(&self) -> u64 {
        self.as_inner().accessed_u64()
    }
    #[rustdoc_skip_body]
    fn last_write_time(&self) -> u64 {
        self.as_inner().modified_u64()
    }
    #[rustdoc_skip_body]
    fn file_size(&self) -> u64 {
        self.as_inner().size()
    }
    #[rustdoc_skip_body]
    fn volume_serial_number(&self) -> Option<u32> {
        self.as_inner().volume_serial_number()
    }
    #[rustdoc_skip_body]
    fn number_of_links(&self) -> Option<u32> {
        self.as_inner().number_of_links()
    }
    #[rustdoc_skip_body]
    fn file_index(&self) -> Option<u64> {
        self.as_inner().file_index()
    }
    #[rustdoc_skip_body]
    fn change_time(&self) -> Option<u64> {
        self.as_inner().changed_u64()
    }
}

/// Windows-specific extensions to [`fs::FileType`].
///
/// On Windows, a symbolic link knows whether it is a file or directory.
#[stable(feature = "windows_file_type_ext", since = "1.64.0")]
pub impl(self) trait FileTypeExt {
    /// Returns `true` if this file type is a symbolic link that is also a directory.
    #[stable(feature = "windows_file_type_ext", since = "1.64.0")]
    fn is_symlink_dir(&self) -> bool;
    /// Returns `true` if this file type is a symbolic link that is also a file.
    #[stable(feature = "windows_file_type_ext", since = "1.64.0")]
    fn is_symlink_file(&self) -> bool;
}

#[stable(feature = "windows_file_type_ext", since = "1.64.0")]
impl FileTypeExt for fs::FileType {
    #[rustdoc_skip_body]
    fn is_symlink_dir(&self) -> bool {
        self.as_inner().is_symlink_dir()
    }
    #[rustdoc_skip_body]
    fn is_symlink_file(&self) -> bool {
        self.as_inner().is_symlink_file()
    }
}

/// Windows-specific extensions to [`fs::FileTimes`].
#[stable(feature = "file_set_times", since = "1.75.0")]
pub impl(self) trait FileTimesExt {
    /// Set the creation time of a file.
    #[stable(feature = "file_set_times", since = "1.75.0")]
    fn set_created(self, t: SystemTime) -> Self;
}

#[stable(feature = "file_set_times", since = "1.75.0")]
impl FileTimesExt for fs::FileTimes {
    #[rustdoc_skip_body]
    fn set_created(mut self, t: SystemTime) -> Self {
        self.as_inner_mut().set_created(t.into_inner());
        self
    }
}

/// Creates a new symlink to a non-directory file on the filesystem.
///
/// The `link` path will be a file symbolic link pointing to the `original`
/// path.
///
/// The `original` path should not be a directory or a symlink to a directory,
/// otherwise the symlink will be broken. Use [`symlink_dir`] for directories.
///
/// This function currently corresponds to [`CreateSymbolicLinkW`][CreateSymbolicLinkW].
/// Note that this [may change in the future][changes].
///
/// [CreateSymbolicLinkW]: https://docs.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-createsymboliclinkw
/// [changes]: io#platform-specific-behavior
///
/// # Examples
///
#[cfg_attr(windows, doc = "```no_run")]
#[cfg_attr(not(windows), doc = "```ignore (needs windows)")]
/// use std::os::windows::fs;
///
/// fn main() -> std::io::Result<()> {
///     fs::symlink_file("a.txt", "b.txt")?;
///     Ok(())
/// }
/// ```
///
/// # 限制
///
/// Windows 将符号链接创建视为[特权操作][symlink-security]，
/// 因此，除非用户修改
/// 他们的系统以允许符号链接创建，否则此函数可能会失败。用户可以尝试启用开发者
/// Mode, granting the `SeCreateSymbolicLinkPrivilege` privilege, or running
/// 在文件系统中创建一个指向目录的新符号链接。
///
/// [symlink-security]: https://docs.microsoft.com/en-us/windows/security/threat-protection/security-policy-settings/create-symbolic-links
#[doc(alias = "CreateSymbolicLink", alias = "CreateSymbolicLinkW")]
#[stable(feature = "symlink", since = "1.1.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "fs_symlink_file")]
#[rustdoc_skip_body]
pub fn symlink_file<P: AsRef<Path>, Q: AsRef<Path>>(original: P, link: Q) -> io::Result<()> {
    sys::fs::symlink_inner(original.as_ref(), link.as_ref(), false)
}

/// Creates a new symlink to a directory on the filesystem.
///
/// The `link` path will be a directory symbolic link pointing to the `original`
/// path.
///
/// The `original` path must be a directory or a symlink to a directory,
/// otherwise the symlink will be broken. Use [`symlink_file`] for other files.
///
/// This function currently corresponds to [`CreateSymbolicLinkW`][CreateSymbolicLinkW].
/// 使用 std::os::windows::fs;
///
/// [CreateSymbolicLinkW]: https://docs.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-createsymboliclinkw
/// [changes]: io#platform-specific-behavior
///
/// # Examples
///
#[cfg_attr(windows, doc = "```no_run")]
#[cfg_attr(not(windows), doc = "```ignore (needs windows)")]
/// fs::symlink_dir("a", "b")?;
///
/// fn main() -> std::io::Result<()> {
/// fs::symlink_dir("a", "b")?;
///     Ok(())
/// }
/// ```
///
/// # Limitations
///
/// Windows treats symlink creation as a [privileged action][symlink-security],
/// therefore this function is likely to fail unless the user makes changes to
/// their system to permit symlink creation. Users can try enabling Developer
/// Mode, granting the `SeCreateSymbolicLinkPrivilege` privilege, or running
/// the process as an administrator.
///
/// [symlink-security]: https://docs.microsoft.com/en-us/windows/security/threat-protection/security-policy-settings/create-symbolic-links
#[doc(alias = "CreateSymbolicLink", alias = "CreateSymbolicLinkW")]
#[stable(feature = "symlink", since = "1.1.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "fs_symlink_dir")]
#[rustdoc_skip_body]
pub fn symlink_dir<P: AsRef<Path>, Q: AsRef<Path>>(original: P, link: Q) -> io::Result<()> {
    sys::fs::symlink_inner(original.as_ref(), link.as_ref(), true)
}

/// Creates a junction point.
///
/// The `link` path will be a directory junction pointing to the original path.
/// If `link` is a relative path then it will be made absolute prior to creating the junction point.
/// The `original` path must be a directory or a link to a directory, otherwise the junction point will be broken.
///
/// If either path is not a local file path then this will fail.
#[unstable(feature = "junction_point", issue = "121709")]
#[rustdoc_skip_body]
pub fn junction_point<P: AsRef<Path>, Q: AsRef<Path>>(original: P, link: Q) -> io::Result<()> {
    sys::fs::junction_point(original.as_ref(), link.as_ref())
}
