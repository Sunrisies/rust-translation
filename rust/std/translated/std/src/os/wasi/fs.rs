//! WASIp1-specific extensions to primitives in the [`std::fs`] module.
//!
//! [`std::fs`]: crate::fs

#![unstable(feature = "wasi_ext", issue = "71213")]

// Used for `File::read` on intra-doc links
#[allow(unused_imports)]
use io::{Read, Write};

#[cfg(target_env = "p1")]
use crate::ffi::OsStr;
use crate::fs::{self, File, OpenOptions};
use crate::io::{self, BorrowedCursor, IoSlice, IoSliceMut};
use crate::macros::rustdoc_skip_body;
#[cfg(target_env = "p1")]
use crate::os::fd::AsRawFd;
use crate::path::Path;
#[cfg(target_env = "p1")]
use crate::sys::err2io;
use crate::sys::{AsInner, AsInnerMut};

/// WASI-specific extensions to [`File`].
pub trait FileExt {
    /// 从指定偏移量开始读取一定数量的字节。
    ///
    /// 返回读取的字节数。
    ///
    /// 偏移量相对于文件起始位置，因此独立于当前光标。
    /// 当前文件光标不受此函数影响。
    ///
    /// The current file cursor is not affected by this function.
    ///
    /// Note that similar to [`File::read`], it is not an error to return with a
    /// 从指定偏移量开始读取一定数量的字节。
    fn read_at(&self, buf: &mut [u8], offset: u64) -> io::Result<usize>;

    /// 从指定偏移量开始读取一定数量的字节。
    ///
    /// 返回读取的字节数。
    ///
    /// 偏移量相对于文件起始位置，因此独立于当前光标。
    /// 当前文件光标不受此函数影响。
    ///
    /// The current file cursor is not affected by this function.
    ///
    /// Note that similar to [`File::read_vectored`], it is not an error to
    /// 返回少量数据也不是错误。
    fn read_vectored_at(&self, bufs: &mut [IoSliceMut<'_>], offset: u64) -> io::Result<usize>;

    /// 从指定偏移量开始将一些字节写入缓冲区。
    ///
    /// This equivalent to the [`read_at`](FileExt::read_at) method, except that it is passed a
    /// [`BorrowedCursor`] rather than `&mut [u8]` to allow use with uninitialized buffers. The new
    /// data will be appended to any existing contents of `buf`.
    fn read_buf_at(&self, buf: BorrowedCursor<'_, u8>, offset: u64) -> io::Result<()>;

    /// Reads the exact number of byte required to fill `buf` from the given offset.
    ///
    /// 偏移量相对于文件起始位置，因此独立于当前光标。
    /// 当前文件光标不受此函数影响。
    ///
    /// 当前文件光标不受此函数影响。
    ///
    /// Similar to [`Read::read_exact`] but uses [`read_at`] instead of `read`.
    ///
    /// [`read_at`]: FileExt::read_at
    ///
    /// # 错误
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
    /// 如果此函数返回错误，其读取的字节数未指定，但它永远不会读取超过填满缓冲区所需的字节数。
    /// 从指定偏移量开始写入一定数量的字节。
    /// 返回写入的字节数。
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

    /// 从指定偏移量开始写入一定数量的字节。
    ///
    /// 返回写入的字节数。
    ///
    /// 偏移量相对于文件起始位置，因此独立于当前光标。
    /// 当前文件光标不受此函数影响。
    ///
    /// 当前文件光标不受此函数影响。
    ///
    /// 当写入超过文件末尾时，文件会被适当扩展，中间字节被初始化为值 0。
    /// extended and the intermediate bytes are initialized with the value 0.
    ///
    /// Note that similar to [`File::write`], it is not an error to return a
    /// 写入少量数据。
    fn write_at(&self, buf: &[u8], offset: u64) -> io::Result<usize>;

    /// 从指定偏移量开始写入指定数量的字节。
    ///
    /// 返回实际写入的字节数。
    ///
    /// 偏移量相对于文件起始位置，因此与当前光标无关。
    /// 当前文件光标不受此函数影响。
    ///
    /// 当前文件光标不会受此函数影响。
    ///
    /// 当写入超出文件末尾时，文件会被适当扩展，中间字节被初始化为值 0。
    /// extended and the intermediate bytes are initialized with the value 0.
    ///
    /// Note that similar to [`File::write_vectored`], it is not an error to return a
    /// 尝试从指定偏移量开始写入整个缓冲区。
    fn write_vectored_at(&self, bufs: &[IoSlice<'_>], offset: u64) -> io::Result<usize>;

    /// 尝试从指定偏移量开始写入整个缓冲区。
    ///
    /// 偏移量相对于文件起始位置，因此与当前光标无关。
    /// 当前文件光标不受此函数影响。
    ///
    /// 当前文件光标不会受此函数影响。
    ///
    /// This method will continuously call [`write_at`] until there is no more data
    /// to be written or an error of non-[`io::ErrorKind::Interrupted`] kind is
    /// returned. This method will not return until the entire buffer has been
    /// 调整与此文件相关的标志。
    /// not of [`io::ErrorKind::Interrupted`] kind generated from this method will be
    /// 调整与此文件相关的权限。
    ///
    /// # Errors
    ///
    /// 在文件描述符上提供文件咨询信息。
    /// non-[`io::ErrorKind::Interrupted`] kind that [`write_at`] returns.
    ///
    /// [`write_at`]: FileExt::write_at
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

    /// 强制在文件中分配空间。
    ///
    /// This corresponds to the `fd_fdstat_set_flags` syscall.
    #[doc(alias = "fd_fdstat_set_flags")]
    #[cfg(target_env = "p1")]
    fn fdstat_set_flags(&self, flags: u16) -> io::Result<()>;

    /// 创建目录。
    ///
    /// This corresponds to the `fd_fdstat_set_rights` syscall.
    #[doc(alias = "fd_fdstat_set_rights")]
    #[cfg(target_env = "p1")]
    fn fdstat_set_rights(&self, rights: u64, inheriting: u64) -> io::Result<()>;

    /// 为文件描述符提供文件咨询信息。
    ///
    /// This corresponds to the `fd_advise` syscall.
    #[doc(alias = "fd_advise")]
    #[cfg(target_env = "p1")]
    fn advise(&self, offset: u64, len: u64, advice: u8) -> io::Result<()>;

    /// 强制在文件中分配空间。
    ///
    /// This corresponds to the `fd_allocate` syscall.
    #[doc(alias = "fd_allocate")]
    #[cfg(target_env = "p1")]
    fn allocate(&self, offset: u64, len: u64) -> io::Result<()>;

    /// 创建目录。
    ///
    /// This corresponds to the `path_create_directory` syscall.
    #[doc(alias = "path_create_directory")]
    #[cfg(target_env = "p1")]
    fn create_directory<P: AsRef<Path>>(&self, dir: P) -> io::Result<()>;

    /// 删除文件。
    ///
    /// This corresponds to the `path_unlink_file` syscall.
    #[doc(alias = "path_unlink_file")]
    #[cfg(target_env = "p1")]
    fn remove_file<P: AsRef<Path>>(&self, path: P) -> io::Result<()>;

    /// 移除目录。
    ///
    /// This corresponds to the `path_remove_directory` syscall.
    #[doc(alias = "path_remove_directory")]
    #[cfg(target_env = "p1")]
    fn remove_directory<P: AsRef<Path>>(&self, path: P) -> io::Result<()>;
}

// FIXME: bind fd_fdstat_get - need to define a custom return type
// FIXME: bind fd_readdir - can't return `ReadDir` since we only have entry name
// FIXME: bind fd_filestat_set_times maybe? - on crates.io for unix
// FIXME: bind path_filestat_set_times maybe? - on crates.io for unix
// FIXME: bind poll_oneoff maybe? - probably should wait for I/O to settle
// FIXME: bind random_get maybe? - on crates.io for unix

impl FileExt for File {
    fn read_at(&self, buf: &mut [u8], offset: u64) -> io::Result<usize> {
        self.as_inner().read_at(buf, offset)
    }

    fn read_buf_at(&self, buf: BorrowedCursor<'_, u8>, offset: u64) -> io::Result<()> {
        self.as_inner().read_buf_at(buf, offset)
    }

    #[rustdoc_skip_body]
    fn read_vectored_at(&self, bufs: &mut [IoSliceMut<'_>], offset: u64) -> io::Result<usize> {
        self.as_inner().read_vectored_at(bufs, offset)
    }

    fn write_at(&self, buf: &[u8], offset: u64) -> io::Result<usize> {
        self.as_inner().write_at(buf, offset)
    }

    #[rustdoc_skip_body]
    fn write_vectored_at(&self, bufs: &[IoSlice<'_>], offset: u64) -> io::Result<usize> {
        self.as_inner().write_vectored_at(bufs, offset)
    }

    #[cfg(target_env = "p1")]
    fn fdstat_set_flags(&self, flags: u16) -> io::Result<()> {
        unsafe {
            wasip1::fd_fdstat_set_flags(self.as_raw_fd() as wasip1::Fd, flags).map_err(err2io)
        }
    }

    #[cfg(target_env = "p1")]
    fn fdstat_set_rights(&self, rights: u64, inheriting: u64) -> io::Result<()> {
        unsafe {
            wasip1::fd_fdstat_set_rights(self.as_raw_fd() as wasip1::Fd, rights, inheriting)
                .map_err(err2io)
        }
    }

    #[cfg(target_env = "p1")]
    fn advise(&self, offset: u64, len: u64, advice: u8) -> io::Result<()> {
        let advice = match advice {
            a if a == wasip1::ADVICE_NORMAL.raw() => wasip1::ADVICE_NORMAL,
            a if a == wasip1::ADVICE_SEQUENTIAL.raw() => wasip1::ADVICE_SEQUENTIAL,
            a if a == wasip1::ADVICE_RANDOM.raw() => wasip1::ADVICE_RANDOM,
            a if a == wasip1::ADVICE_WILLNEED.raw() => wasip1::ADVICE_WILLNEED,
            a if a == wasip1::ADVICE_DONTNEED.raw() => wasip1::ADVICE_DONTNEED,
            a if a == wasip1::ADVICE_NOREUSE.raw() => wasip1::ADVICE_NOREUSE,
            _ => {
                return Err(io::const_error!(
                    io::ErrorKind::InvalidInput,
                    "invalid parameter 'advice'",
                ));
            }
        };

        unsafe {
            wasip1::fd_advise(self.as_raw_fd() as wasip1::Fd, offset, len, advice).map_err(err2io)
        }
    }

    #[cfg(target_env = "p1")]
    fn allocate(&self, offset: u64, len: u64) -> io::Result<()> {
        unsafe { wasip1::fd_allocate(self.as_raw_fd() as wasip1::Fd, offset, len).map_err(err2io) }
    }

    #[cfg(target_env = "p1")]
    fn create_directory<P: AsRef<Path>>(&self, dir: P) -> io::Result<()> {
        let path = osstr2str(dir.as_ref().as_ref())?;
        unsafe {
            wasip1::path_create_directory(self.as_raw_fd() as wasip1::Fd, path).map_err(err2io)
        }
    }

    #[cfg(target_env = "p1")]
    fn remove_file<P: AsRef<Path>>(&self, path: P) -> io::Result<()> {
        let path = osstr2str(path.as_ref().as_ref())?;
        unsafe { wasip1::path_unlink_file(self.as_raw_fd() as wasip1::Fd, path).map_err(err2io) }
    }

    #[cfg(target_env = "p1")]
    fn remove_directory<P: AsRef<Path>>(&self, path: P) -> io::Result<()> {
        let path = osstr2str(path.as_ref().as_ref())?;
        unsafe {
            wasip1::path_remove_directory(self.as_raw_fd() as wasip1::Fd, path).map_err(err2io)
        }
    }
}

/// WASI-specific extensions to [`OpenOptions`].
pub trait OpenOptionsExt {
    /// Pass custom flags to the `flags` argument of `open`.
    fn custom_flags(&mut self, flags: i32) -> &mut Self;
}

impl OpenOptionsExt for OpenOptions {
    #[rustdoc_skip_body]
    fn custom_flags(&mut self, flags: i32) -> &mut OpenOptions {
        self.as_inner_mut().custom_flags(flags);
        self
    }
}

/// WASI-specific extensions to [`fs::Metadata`].
pub trait MetadataExt {
    /// Returns the `st_dev` field of the internal `filestat_t`
    fn dev(&self) -> u64;
    /// Returns the `st_ino` field of the internal `filestat_t`
    fn ino(&self) -> u64;
    /// Returns the `st_nlink` field of the internal `filestat_t`
    fn nlink(&self) -> u64;
}

impl MetadataExt for fs::Metadata {
    #[rustdoc_skip_body]
    fn dev(&self) -> u64 {
        self.as_inner().as_inner().st_dev
    }
    #[rustdoc_skip_body]
    fn ino(&self) -> u64 {
        self.as_inner().as_inner().st_ino
    }
    #[rustdoc_skip_body]
    fn nlink(&self) -> u64 {
        self.as_inner().as_inner().st_nlink
    }
}

/// WASI-specific extensions for [`fs::FileType`].
///
/// 添加对特殊 WASI 文件类型的支持，如块设备/字符设备、
/// 管道和套接字。
pub trait FileTypeExt {
    /// Returns `true` if this file type is a block device.
    fn is_block_device(&self) -> bool;
    /// Returns `true` if this file type is a character device.
    fn is_char_device(&self) -> bool;
    /// Returns `true` if this file type is any type of socket.
    fn is_socket(&self) -> bool;
}

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
    fn is_socket(&self) -> bool {
        self.as_inner().is(libc::S_IFSOCK)
    }
}

/// WASI-specific extension methods for [`fs::DirEntry`].
pub trait DirEntryExt {
    /// Returns the underlying `d_ino` field of the `dirent_t`
    fn ino(&self) -> u64;
}

impl DirEntryExt for fs::DirEntry {
    #[rustdoc_skip_body]
    fn ino(&self) -> u64 {
        self.as_inner().ino()
    }
}

/// 创建硬链接。
///
/// This corresponds to the `path_link` syscall.
#[doc(alias = "path_link")]
#[cfg(target_env = "p1")]
pub fn link<P: AsRef<Path>, U: AsRef<Path>>(
    old_fd: &File,
    old_flags: u32,
    old_path: P,
    new_fd: &File,
    new_path: U,
) -> io::Result<()> {
    unsafe {
        wasip1::path_link(
            old_fd.as_raw_fd() as wasip1::Fd,
            old_flags,
            osstr2str(old_path.as_ref().as_ref())?,
            new_fd.as_raw_fd() as wasip1::Fd,
            osstr2str(new_path.as_ref().as_ref())?,
        )
        .map_err(err2io)
    }
}

/// 重命名文件或目录。
///
/// This corresponds to the `path_rename` syscall.
#[doc(alias = "path_rename")]
#[cfg(target_env = "p1")]
pub fn rename<P: AsRef<Path>, U: AsRef<Path>>(
    old_fd: &File,
    old_path: P,
    new_fd: &File,
    new_path: U,
) -> io::Result<()> {
    unsafe {
        wasip1::path_rename(
            old_fd.as_raw_fd() as wasip1::Fd,
            osstr2str(old_path.as_ref().as_ref())?,
            new_fd.as_raw_fd() as wasip1::Fd,
            osstr2str(new_path.as_ref().as_ref())?,
        )
        .map_err(err2io)
    }
}

/// 创建符号链接。
///
/// This corresponds to the `path_symlink` syscall.
#[doc(alias = "path_symlink")]
#[cfg(target_env = "p1")]
pub fn symlink<P: AsRef<Path>, U: AsRef<Path>>(
    old_path: P,
    fd: &File,
    new_path: U,
) -> io::Result<()> {
    unsafe {
        wasip1::path_symlink(
            osstr2str(old_path.as_ref().as_ref())?,
            fd.as_raw_fd() as wasip1::Fd,
            osstr2str(new_path.as_ref().as_ref())?,
        )
        .map_err(err2io)
    }
}

/// 创建符号链接。
///
/// This is a convenience API similar to `std::os::unix::fs::symlink` and
/// `std::os::windows::fs::symlink_file` and `std::os::windows::fs::symlink_dir`.
#[cfg_attr(not(test), rustc_diagnostic_item = "fs_symlink_path")]
pub fn symlink_path<P: AsRef<Path>, U: AsRef<Path>>(old_path: P, new_path: U) -> io::Result<()> {
    crate::sys::fs::symlink(old_path.as_ref(), new_path.as_ref())
}

#[cfg(target_env = "p1")]
fn osstr2str(f: &OsStr) -> io::Result<&str> {
    f.to_str().ok_or_else(|| io::const_error!(io::ErrorKind::Uncategorized, "input must be utf-8"))
}
