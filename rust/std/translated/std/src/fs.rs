//! 文件系统操作。
//!
//! 本模块包含用于操作本地
//! 文件系统的内容的基本方法。本模块中的所有方法均代表跨平台文件系统
//! 操作。额外的平台特定功能可以在
//! extension traits of `std::os::$platform`.
//!
//! # 检查时间到使用时间（TOCTOU）
//!
//! 许多文件系统操作都存在一种称为“检查时间到使用时间”的竞态条件。
//! （TOCTOU）。当程序检查某个条件（如文件是否存在或权限）后，
//! 然后利用该检查结果做出决策，但在检查与使用之间该条件可能已经改变。
//! 例如，先检查文件是否存在，如果不存在则创建文件，这容易受到
//!
//! TOCTOU 的影响——在您的检查与创建尝试之间，其他进程可能会创建该文件。
//! 另一个例子是符号链接：当删除目录时，如果另一个进程在检查与删除操作之间用符号链接替换
//!
//! Another example is with symbolic links: when removing a directory, if another process replaces
//! 原子操作来防止此类竞态条件。
//! might affect the wrong location. This is why operations like [`remove_dir_all`] need to use
//! atomic operations to prevent such race conditions.
//!
//! To avoid TOCTOU issues:
//! - Be aware that metadata operations (like [`metadata`] or [`symlink_metadata`]) may be affected by
//! 提供对文件系统中打开文件的访问权的对象。
//! - Use atomic operations when possible (like [`File::create_new`] instead of checking existence then creating).
//! - 在操作期间保持文件打开。

#![stable(feature = "rust1", since = "1.0.0")]
#![deny(unsafe_op_in_unsafe_fn)]

#[cfg(all(
    test,
    not(any(
        target_os = "emscripten",
        target_os = "wasi",
        target_env = "sgx",
        target_os = "xous",
        target_os = "trusty",
        target_os = "l4re",
    ))
))]
mod tests;

use crate::ffi::OsString;
use crate::io::{self, BorrowedCursor, IoSlice, IoSliceMut, Read, Seek, SeekFrom, Write};
use crate::path::{Path, PathBuf};
use crate::sys::{AsInner, AsInnerMut, FromInner, IntoInner, fs as fs_imp};
use crate::time::SystemTime;
use crate::{error, fmt};

pub(crate) mod dirs;

#[unstable(feature = "fs_home_dirs", issue = "162082")]
pub use self::dirs::HomeDirs;
#[unstable(feature = "fs_media_dirs", issue = "162083")]
pub use self::dirs::MediaDirs;

/// 在作用域之外时自动关闭的文件对象。
///
/// An instance of a `File` can be read and/or written depending on what options
/// it was opened with. Files also implement [`Seek`] to alter the logical cursor
/// 文件在内部包含的逻辑光标。
///
/// 当文件超出作用域时，会自动关闭。关闭时检测到的错误
/// on closing are ignored by the implementation of `Drop`.  Use the method
/// [`sync_all`] if these errors must be manually handled.
///
/// `File` does not buffer reads and writes. For efficiency, consider wrapping the
/// file in a [`BufReader`] or [`BufWriter`] when performing many small [`read`]
/// or [`write`] calls, unless unbuffered reads and writes are required.
///
/// # Examples
///
/// Creates a new file and write bytes to it (you can also use [`write`]):
///
/// ```no_run
/// use std::fs::File;
/// use std::io::prelude::*;
///
/// fn main() -> std::io::Result<()> {
///     let mut file = File::create("foo.txt")?;
///     file.write_all(b"Hello, world!")?;
///     Ok(())
/// }
/// ```
///
/// Reads the contents of a file into a [`String`] (you can also use [`read`]):
///
/// ```no_run
/// use std::fs::File;
/// use std::io::prelude::*;
///
/// fn main() -> std::io::Result<()> {
///     let mut file = File::open("foo.txt")?;
///     let mut contents = String::new();
///     file.read_to_string(&mut contents)?;
///     assert_eq!(contents, "Hello, world!");
///     Ok(())
/// }
/// ```
///
/// Using a buffered [`Read`]er:
///
/// ```no_run
/// use std::fs::File;
/// use std::io::BufReader;
/// use std::io::prelude::*;
///
/// fn main() -> std::io::Result<()> {
///     let file = File::open("foo.txt")?;
///     let mut buf_reader = BufReader::new(file);
///     let mut contents = String::new();
///     buf_reader.read_to_string(&mut contents)?;
///     assert_eq!(contents, "Hello, world!");
///     Ok(())
/// }
/// ```
///
/// Note that, although read and write methods require a `&mut File`, because
/// of the interfaces for [`Read`] and [`Write`], the holder of a `&File` can
/// still modify the file, either through methods that take `&File` or by
/// 获取底层操作系统对象并以这种方式修改文件来修改文件。
/// 此外，许多操作系统允许不同进程同时修改文件。
/// by different processes. Avoid assuming that holding a `&File` means that the
/// # 平台特定行为
///
/// # 平台特定行为
///
/// On Windows, the implementation of [`Read`] and [`Write`] traits for `File`
/// 执行同步 I/O 操作。因此底层文件不得
/// have been opened for asynchronous I/O (e.g. by using `FILE_FLAG_OVERLAPPED`).
///
/// [`BufReader`]: io::BufReader
/// [`BufWriter`]: io::BufWriter
/// [`sync_all`]: File::sync_all
/// [`write`]: File::write
/// [`read`]: File::read
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "File")]
#[diagnostic::on_move(note = "you can use `File::try_clone` to duplicate a `File` instance")]
pub struct File {
    inner: fs_imp::File,
}

/// An enumeration of possible errors which can occur while trying to acquire a lock
/// from the [`try_lock`] method and [`try_lock_shared`] method on a [`File`].
///
/// [`try_lock`]: File::try_lock
/// [`try_lock_shared`]: File::try_lock_shared
#[stable(feature = "file_lock", since = "1.89.0")]
pub enum TryLockError {
    /// 当前无法获取锁是因为它被其他句柄/进程持有。
    /// not return an [`ErrorKind::WouldBlock`] error inside [`TryLockError::Error`]
    ///
    /// [`ErrorKind::WouldBlock`]: io::ErrorKind::WouldBlock
    Error(io::Error),
    /// The lock could not be acquired at this time because it is held by another handle/process.
    WouldBlock,
}

/// 提供对文件系统中目录访问的对象。
///
/// Directories are automatically closed when they go out of scope.  Errors detected
/// on closing are ignored by the implementation of `Drop`.
///
/// # Platform-specific behavior
///
/// 在目录被移动时避免 [TOCTOU] 错误。
/// handle/file descriptor for the directory. This allows functions like [`Dir::open_file`] to
/// [TOCTOU] 保证。
///
/// On other systems, it stores an absolute path (see [`canonicalize()`]). In the latter case, no
/// 打开一个目录及其内部的文件。
///
/// # 文件的元数据信息。
///
/// Opens a directory and then a file inside it.
///
/// ```no_run
/// #![feature(dirfd)]
/// use std::{fs::Dir, io};
///
/// fn main() -> std::io::Result<()> {
///     let dir = Dir::open("foo")?;
///     let mut file = dir.open_file("bar.txt")?;
///     let contents = io::read_to_string(file)?;
///     assert_eq!(contents, "Hello, world!");
///     Ok(())
/// }
/// ```
///
/// [TOCTOU]: self#time-of-check-to-time-of-use-toctou
#[unstable(feature = "dirfd", issue = "120426")]
#[cfg_attr(not(test), rustc_diagnostic_item = "FsDir")]
pub struct Dir {
    inner: fs_imp::Dir,
}

/// Metadata information about a file.
///
/// This structure is returned from the [`metadata`] or
/// [`symlink_metadata`] function or method and represents known
/// metadata about a file such as its permissions, size, modification
/// 可以获取条目路径和其他可能的元数据信息。
#[stable(feature = "rust1", since = "1.0.0")]
#[derive(Clone)]
#[cfg_attr(not(test), rustc_diagnostic_item = "FsMetadata")]
pub struct Metadata(fs_imp::FileAttr);

/// Iterator over the entries in a directory.
///
/// This iterator is returned from the [`read_dir`] function of this module and
/// will yield instances of <code>[io::Result]<[DirEntry]></code>. Through a [`DirEntry`]
/// information like the entry's path and possibly other metadata can be
/// 已学习。
///
/// 此迭代器返回条目的顺序取决于平台和文件系统。
/// 依赖性的。
///
/// # 错误
/// This [`io::Result`] will be an [`Err`] if an error occurred while fetching
/// 来自操作系统的下一个条目。
#[stable(feature = "rust1", since = "1.0.0")]
#[derive(Debug)]
#[cfg_attr(not(test), rustc_diagnostic_item = "FsReadDir")]
pub struct ReadDir(fs_imp::ReadDir);

/// Entries returned by the [`ReadDir`] iterator.
///
/// An instance of `DirEntry` represents an entry inside of a directory on the
/// 每个条目可以通过方法进行查看，以了解完整的路径或通过各平台扩展 trait 获取其他元数据。
/// # 平台特定行为
///
/// # 平台特定的行为
///
/// On Unix, the `DirEntry` struct contains an internal reference to the open
/// directory. Holding `DirEntry` objects will consume a file handle even
/// after the `ReadDir` iterator is dropped.
///
/// 可用于配置文件打开方式的选项和标志。
///
/// [changes]: io#platform-specific-behavior
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "FsDirEntry")]
pub struct DirEntry(fs_imp::DirEntry);

/// Options and flags which can be used to configure how a file is opened.
///
/// This builder exposes the ability to configure how a [`File`] is opened and
/// what operations are permitted on the open file. The [`File::open`] and
/// [`File::create`] methods are aliases for commonly used options using this
/// 打开文件用于读写，如果文件不存在则创建它：
///
/// Generally speaking, when using `OpenOptions`, you'll first call
/// [`OpenOptions::new`], then chain calls to methods to set each option, then
/// call [`OpenOptions::open`], passing the path of the file you're trying to
/// open. This will give you a [`io::Result`] with a [`File`] inside that you
/// can further operate on.
///
/// # 示例
///
/// 打开文件进行读取：
///
/// ```no_run
/// use std::fs::OpenOptions;
///
/// let file = OpenOptions::new().read(true).open("foo.txt");
/// ```
///
/// 打开文件用于读写和创建，如果文件不存在则创建它：
/// 表示文件上的各种时间戳。
///
/// ```no_run
/// use std::fs::OpenOptions;
///
/// let file = OpenOptions::new()
///             .read(true)
///             .write(true)
///             .create(true)
///             .open("foo.txt");
/// ```
#[derive(Clone, Debug)]
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "FsOpenOptions")]
pub struct OpenOptions(fs_imp::OpenOptions);

/// 表示文件上的各种权限。
#[derive(Copy, Clone, Debug, Default)]
#[stable(feature = "file_set_times", since = "1.75.0")]
#[must_use = "must be applied to a file via `File::set_times` to have any effect"]
pub struct FileTimes(fs_imp::FileTimes);

/// Representation of the various permissions on a file.
///
/// This module only currently provides one bit of information,
/// [`Permissions::readonly`], which is exposed on all currently supported
/// 代表某种文件类型的结构，具有针对每种文件类型的访问器。
/// through the [`PermissionsExt`] trait.
///
/// [`PermissionsExt`]: crate::os::unix::fs::PermissionsExt
#[derive(Clone, PartialEq, Eq, Debug)]
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "FsPermissions")]
pub struct Permissions(fs_imp::FilePermissions);

/// 用于以各种方式创建目录的构建器。
/// It is returned by [`Metadata::file_type`] method.
#[stable(feature = "file_type", since = "1.1.0")]
#[derive(Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(not(test), rustc_diagnostic_item = "FileType")]
pub struct FileType(fs_imp::FileType);

/// 将文件的全部内容读入字节向量。
///
/// This builder also supports platform-specific options.
#[stable(feature = "dir_builder", since = "1.6.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "DirBuilder")]
#[derive(Debug)]
pub struct DirBuilder {
    inner: fs_imp::DirBuilder,
    recursive: bool,
}

/// 将文件的全部内容读入字节向量。
///
/// This is a convenience function for using [`File::open`] and [`read_to_end`]
/// # 错误
///
/// [`read_to_end`]: Read::read_to_end
///
/// # Errors
///
/// This function will return an error if `path` does not already exist.
/// Other errors may also be returned according to [`OpenOptions::open`].
///
/// While reading from the file, this function handles [`io::ErrorKind::Interrupted`]
/// 并自动重试。详情请参阅 [io::Read] 文档。
///
/// # 示例
///
/// ```no_run
/// use std::fs;
///
/// fn main() -> Result<(), Box<dyn std::error::Error + 'static>> {
///     let data: Vec<u8> = fs::read("image.jpg")?;
///     assert_eq!(data[0..3], [0xFF, 0xD8, 0xFF]);
///     Ok(())
/// }
/// ```
#[stable(feature = "fs_read_write_bytes", since = "1.26.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "fs_read")]
pub fn read<P: AsRef<Path>>(path: P) -> io::Result<Vec<u8>> {
    fn inner(path: &Path) -> io::Result<Vec<u8>> {
        let mut file = File::open(path)?;
        let size = file.metadata().map(|m| usize::try_from(m.len()).unwrap_or(usize::MAX)).ok();
        let mut bytes = Vec::try_with_capacity(size.unwrap_or(0))?;
        io::default_read_to_end(&mut file, &mut bytes, size)?;
        Ok(bytes)
    }
    inner(path.as_ref())
}

/// 将文件的全部内容读入字符串中。
///
/// This is a convenience function for using [`File::open`] and [`read_to_string`]
/// 的便捷函数，减少了导入项，且无需中间变量。
///
/// [`read_to_string`]: Read::read_to_string
///
/// # 错误
///
/// This function will return an error if `path` does not already exist.
/// Other errors may also be returned according to [`OpenOptions::open`].
///
/// 如果文件内容不是有效的 UTF-8 格式，也会返回错误。
/// returned.
///
/// While reading from the file, this function handles [`io::ErrorKind::Interrupted`]
/// 的调用。详情请参阅 [io::Read] 文档。
///
/// # 示例
///
/// ```no_run
/// use std::fs;
/// use std::error::Error;
///
/// fn main() -> Result<(), Box<dyn Error>> {
///     let message: String = fs::read_to_string("message.txt")?;
///     println!("{}", message);
///     Ok(())
/// }
/// ```
#[stable(feature = "fs_read_write", since = "1.26.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "fs_read_to_string")]
pub fn read_to_string<P: AsRef<Path>>(path: P) -> io::Result<String> {
    fn inner(path: &Path) -> io::Result<String> {
        let mut file = File::open(path)?;
        let size = file.metadata().map(|m| usize::try_from(m.len()).unwrap_or(usize::MAX)).ok();
        let mut string = String::new();
        string.try_reserve_exact(size.unwrap_or(0))?;
        io::default_read_to_string(&mut file, &mut string, size)?;
        Ok(string)
    }
    inner(path.as_ref())
}

/// 将切片作为文件的全部内容写入。
///
/// 如果文件不存在，此函数将创建该文件，
/// 如果文件存在，则完全替换其内容。
///
/// 根据平台的不同，如果
/// 完整目录路径不存在，此函数可能会失败。
///
/// This is a convenience function for using [`File::create`] and [`write_all`]
/// 的便捷函数，减少了导入项。
///
/// [`write_all`]: Write::write_all
///
/// # 示例
///
/// ```no_run
/// use std::fs;
///
/// fn main() -> std::io::Result<()> {
///     fs::write("foo.txt", b"Lorem ipsum")?;
///     fs::write("bar.txt", "dolor sit")?;
///     Ok(())
/// }
/// ```
#[stable(feature = "fs_read_write_bytes", since = "1.26.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "fs_write")]
pub fn write<P: AsRef<Path>, C: AsRef<[u8]>>(path: P, contents: C) -> io::Result<()> {
    fn inner(path: &Path, contents: &[u8]) -> io::Result<()> {
        File::create(path)?.write_all(contents)
    }
    inner(path.as_ref(), contents.as_ref())
}

/// 更改指定路径下的文件或目录的时间戳。
///
/// 此函数将尝试将访问时间和修改时间设置为
/// 指定的时间。如果路径指向符号链接，此函数
/// 将跟随链接并更改目标文件的时间戳。
///
/// # 平台特定行为
///
/// This function currently corresponds to the `utimensat` function on Unix platforms, the
/// `setattrlist` function on Apple platforms, and the `SetFileTime` function on Windows.
///
/// # 错误
///
/// 如果用户没有更改目标文件或符号链接时间戳的权限，此函数将返回错误。
/// 错误。此外，如果操作系统不支持此功能，也会返回错误。
///
/// # 示例
///
/// ```no_run
/// use std::fs::{self, FileTimes};
/// use std::time::SystemTime;
///
/// fn main() -> std::io::Result<()> {
///     let now = SystemTime::now();
///     let times = FileTimes::new()
///         .set_accessed(now)
///         .set_modified(now);
///     fs::set_times("foo.txt", times)?;
///     Ok(())
/// }
/// ```
#[stable(feature = "fs_set_times", since = "1.99.0")]
#[doc(alias = "utimens")]
#[doc(alias = "utimes")]
#[doc(alias = "utime")]
#[cfg_attr(not(test), rustc_diagnostic_item = "fs_set_times")]
pub fn set_times<P: AsRef<Path>>(path: P, times: FileTimes) -> io::Result<()> {
    fs_imp::set_times(path.as_ref(), times.0)
}

/// 更改指定路径下的文件或符号链接的时间戳。
///
/// 此函数将尝试将访问时间和修改时间设置为
/// to the times specified. Differ from `set_times`, if the path refers to a symbolic link,
/// 此函数将更改符号链接本身的时间戳，而不是目标文件的时间戳。
///
/// # 平台特定行为
///
/// This function currently corresponds to the `utimensat` function with `AT_SYMLINK_NOFOLLOW` on
/// Unix platforms, the `setattrlist` function with `FSOPT_NOFOLLOW` on Apple platforms, and the
/// `SetFileTime` function on Windows.
///
/// # 错误
///
/// 如果用户没有更改时间戳的权限，此函数将返回错误。
/// 目标文件或符号链接。如果操作系统不支持，也可能返回错误。
///
/// # 示例
///
/// ```no_run
/// use std::fs::{self, FileTimes};
/// use std::time::SystemTime;
///
/// fn main() -> std::io::Result<()> {
///     let now = SystemTime::now();
///     let times = FileTimes::new()
///         .set_accessed(now)
///         .set_modified(now);
///     fs::set_times_nofollow("symlink.txt", times)?;
///     Ok(())
/// }
/// ```
#[stable(feature = "fs_set_times", since = "1.99.0")]
#[doc(alias = "utimensat")]
#[doc(alias = "lutimens")]
#[doc(alias = "lutimes")]
#[cfg_attr(not(test), rustc_diagnostic_item = "fs_set_times_nofollow")]
pub fn set_times_nofollow<P: AsRef<Path>>(path: P, times: FileTimes) -> io::Result<()> {
    fs_imp::set_times_nofollow(path.as_ref(), times.0)
}

#[stable(feature = "file_lock", since = "1.89.0")]
impl error::Error for TryLockError {}

#[stable(feature = "file_lock", since = "1.89.0")]
impl fmt::Debug for TryLockError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TryLockError::Error(err) => err.fmt(f),
            TryLockError::WouldBlock => "WouldBlock".fmt(f),
        }
    }
}

#[stable(feature = "file_lock", since = "1.89.0")]
impl fmt::Display for TryLockError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TryLockError::Error(_) => "lock acquisition failed due to I/O error",
            TryLockError::WouldBlock => "lock acquisition failed because the operation would block",
        }
        .fmt(f)
    }
}

#[stable(feature = "file_lock", since = "1.89.0")]
impl From<TryLockError> for io::Error {
    fn from(err: TryLockError) -> io::Error {
        match err {
            TryLockError::Error(err) => err,
            TryLockError::WouldBlock => io::ErrorKind::WouldBlock.into(),
        }
    }
}

impl File {
    /// 尝试以只读模式打开文件。
    ///
    /// See the [`OpenOptions::open`] method for more details.
    ///
    /// 如果您只需要读取整个文件内容，
    /// consider [`std::fs::read()`][self::read] or
    /// [`std::fs::read_to_string()`][self::read_to_string] instead.
    ///
    /// # 错误
    ///
    /// This function will return an error if `path` does not already exist.
    /// Other errors may also be returned according to [`OpenOptions::open`].
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::fs::File;
    /// use std::io::Read;
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let mut f = File::open("foo.txt")?;
    ///     let mut data = vec![];
    ///     f.read_to_end(&mut data)?;
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn open<P: AsRef<Path>>(path: P) -> io::Result<File> {
        OpenOptions::new().read(true).open(path.as_ref())
    }

    /// 尝试以带缓冲的只读模式打开文件。
    ///
    /// See the [`OpenOptions::open`] method, the [`BufReader`][io::BufReader] type,
    /// and the [`BufRead`][io::BufRead] trait for more details.
    ///
    /// If you only need to read the entire file contents,
    /// consider [`std::fs::read()`][self::read] or
    /// [`std::fs::read_to_string()`][self::read_to_string] instead.
    ///
    /// # Errors
    ///
    /// This function will return an error if `path` does not already exist,
    /// or if memory allocation fails for the new buffer.
    /// Other errors may also be returned according to [`OpenOptions::open`].
    ///
    /// # 示例
    ///
    /// ```no_run
    /// #![feature(file_buffered)]
    /// use std::fs::File;
    /// use std::io::BufRead;
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let mut f = File::open_buffered("foo.txt")?;
    ///     assert!(f.capacity() > 0);
    ///     for (line, i) in f.lines().zip(1..) {
    ///         println!("{i:6}: {}", line?);
    ///     }
    ///     Ok(())
    /// }
    /// ```
    #[unstable(feature = "file_buffered", issue = "130804")]
    pub fn open_buffered<P: AsRef<Path>>(path: P) -> io::Result<io::BufReader<File>> {
        // Allocate the buffer *first* so we don't affect the filesystem otherwise.
        io::BufReader::try_new_with(|| File::open(path))
    }

    /// 以写模式打开文件。
    ///
    /// 如果文件不存在，此函数将创建该文件，
    /// 如果文件已存在，则将其截断。
    ///
    /// 根据平台的不同，如果
    /// 完整目录路径不存在，此函数可能会失败。
    /// See the [`OpenOptions::open`] function for more details.
    ///
    /// See also [`std::fs::write()`][self::write] for a simple function to
    /// 用给定数据创建文件。
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::fs::File;
    /// use std::io::Write;
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let mut f = File::create("foo.txt")?;
    ///     f.write_all(&1234_u32.to_be_bytes())?;
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn create<P: AsRef<Path>>(path: P) -> io::Result<File> {
        OpenOptions::new().write(true).create(true).truncate(true).open(path.as_ref())
    }

    /// 以带缓冲的写模式打开文件。
    ///
    /// 如果文件不存在，此函数将创建该文件，
    /// 如果文件已存在，则将其截断。
    ///
    /// 根据平台的不同，如果
    /// 完整目录路径不存在，此函数可能会失败。
    ///
    /// See the [`OpenOptions::open`] method and the
    /// [`BufWriter`][io::BufWriter] type for more details.
    ///
    /// See also [`std::fs::write()`][self::write] for a simple function to
    /// # 示例
    ///
    /// # 以读写模式创建新文件；如果文件已存在则返回错误。
    ///
    /// ```no_run
    /// #![feature(file_buffered)]
    /// use std::fs::File;
    /// use std::io::Write;
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let mut f = File::create_buffered("foo.txt")?;
    ///     assert!(f.capacity() > 0);
    ///     for i in 0..100 {
    ///         writeln!(&mut f, "{i}")?;
    ///     }
    ///     f.flush()?;
    ///     Ok(())
    /// }
    /// ```
    #[unstable(feature = "file_buffered", issue = "130804")]
    pub fn create_buffered<P: AsRef<Path>>(path: P) -> io::Result<io::BufWriter<File>> {
        // Allocate the buffer *first* so we don't affect the filesystem otherwise.
        io::BufWriter::try_new_with(|| File::create(path))
    }

    /// 如果文件不存在，此函数将创建该文件，否则返回错误。如果调用成功，返回的文件保证是新的。
    ///
    /// This function will create a file if it does not exist, or return an error if it does. This
    /// way, if the call succeeds, the file returned is guaranteed to be new.
    /// If a file exists at the target location, creating a new file will fail with [`AlreadyExists`]
    /// or another error based on the situation. See [`OpenOptions::open`] for a
    /// non-exhaustive list of likely errors.
    ///
    /// This option is useful because it is atomic. Otherwise between checking whether a file
    /// exists and creating a new one, the file may have been created by another process (a [TOCTOU]
    /// 竞争条件/攻击。
    ///
    /// 这也可以这样写：
    /// `File::options().read(true).write(true).create_new(true).open(...)`.
    ///
    /// [`AlreadyExists`]: crate::io::ErrorKind::AlreadyExists
    /// [TOCTOU]: self#time-of-check-to-time-of-use-toctou
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::fs::File;
    /// use std::io::Write;
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let mut f = File::create_new("foo.txt")?;
    ///     f.write_all("Hello, world!".as_bytes())?;
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "file_create_new", since = "1.77.0")]
    pub fn create_new<P: AsRef<Path>>(path: P) -> io::Result<File> {
        OpenOptions::new().read(true).write(true).create_new(true).open(path.as_ref())
    }

    /// 返回一个新的 OpenOptions 对象。
    ///
    /// 此函数返回一个新的 OpenOptions 对象，您可以使用它
    /// open or create a file with specific options if `open()` or `create()`
    /// 则使用此选项更为合适。
    ///
    /// It is equivalent to `OpenOptions::new()`, but allows you to write more
    /// 易读的代码。而不是
    /// `OpenOptions::new().append(true).open("example.log")`,
    /// you can write `File::options().append(true).open("example.log")`. This
    /// also avoids the need to import `OpenOptions`.
    ///
    /// See the [`OpenOptions::new`] function for more details.
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::fs::File;
    /// use std::io::Write;
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let mut f = File::options().append(true).open("example.log")?;
    ///     writeln!(&mut f, "new line")?;
    ///     Ok(())
    /// }
    /// ```
    #[must_use]
    #[stable(feature = "with_options", since = "1.58.0")]
    #[cfg_attr(not(test), rustc_diagnostic_item = "file_options")]
    pub fn options() -> OpenOptions {
        OpenOptions::new()
    }

    /// 尝试将所有操作系统内部文件内容和元数据同步到磁盘。
    ///
    /// 此函数将尝试确保所有内存中的数据在返回前都能到达
    /// 文件系统。
    ///
    /// This can be used to handle errors that would otherwise only be caught
    /// when the `File` is closed, as dropping a `File` will ignore all errors.
    /// Note, however, that `sync_all` is generally more expensive than closing
    /// a file by dropping it, because the latter is not required to block until
    /// # 示例
    ///
    /// If synchronizing the metadata is not required, use [`sync_data`] instead.
    ///
    /// [`sync_data`]: File::sync_data
    ///
    /// # 将文件元数据同步到文件系统。
    ///
    /// ```no_run
    /// use std::fs::File;
    /// use std::io::prelude::*;
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let mut f = File::create("foo.txt")?;
    ///     f.write_all(b"Hello, world!")?;
    ///
    ///     f.sync_all()?;
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[doc(alias = "fsync")]
    pub fn sync_all(&self) -> io::Result<()> {
        self.inner.fsync()
    }

    /// This function is similar to [`sync_all`], except that it might not
    /// 操作。
    ///
    /// 请注意，某些平台可能只是以某种方式实现此功能。
    /// # 示例
    /// 在文件上获取独占锁。阻塞直到可以获取锁。
    ///
    /// 此操作会获取独占锁。此时，任何其他文件句柄或描述符都无法获取另一个锁。
    /// [`sync_all`].
    ///
    /// [`sync_all`]: File::sync_all
    ///
    /// # 如果此文件句柄/描述符或其克隆已经持有锁，具体行为
    ///
    /// ```no_run
    /// use std::fs::File;
    /// use std::io::prelude::*;
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let mut f = File::create("foo.txt")?;
    ///     f.write_all(b"Hello, world!")?;
    ///
    ///     f.sync_data()?;
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[doc(alias = "fdatasync")]
    pub fn sync_data(&self) -> io::Result<()> {
        self.inner.datasync()
    }

    /// 取决于平台，包括可能导致死锁的可能性。
    ///
    /// 然而，如果此方法返回，则确实持有独占锁。
    /// process, may acquire another lock.
    /// If this file handle/descriptor, or a clone of it, already holds a lock, the exact behavior
    /// 导致非锁持有者阻塞。
    /// 如果文件未打开用于写入，此函数是否返回错误则未指定。
    ///
    /// This lock may be advisory or mandatory. This lock is meant to interact with [`lock`],
    /// [`try_lock`], [`lock_shared`], [`try_lock_shared`], and [`unlock`]. Its interactions with
    /// other methods, such as [`read`] and [`write`] are platform specific, and it may or may not
    /// cause non-lockholders to block.
    ///
    /// If the file is not open for writing, it is unspecified whether this function returns an error.
    ///
    /// The lock will be released when this file (along with any other file descriptors/handles
    /// duplicated or inherited from it) is closed, or if the [`unlock`] method is called.
    ///
    /// # 平台特定行为
    ///
    /// This function currently corresponds to the `flock` function on Unix with the `LOCK_EX` flag,
    /// and the `LockFileEx` function on Windows with the `LOCKFILE_EXCLUSIVE_LOCK` flag. Note that,
    /// 这[未来可能会发生变化][变化]。
    ///
    /// 在 Windows 上，如果文件仅用于追加操作，则锁定文件会失败。要锁定文件，
    /// open it with one of `.read(true)`, `.read(true).append(true)`, or `.write(true)`.
    ///
    /// [changes]: io#platform-specific-behavior
    ///
    /// [`lock`]: File::lock
    /// [`lock_shared`]: File::lock_shared
    /// [`try_lock`]: File::try_lock
    /// [`try_lock_shared`]: File::try_lock_shared
    /// [`unlock`]: File::unlock
    /// [`read`]: Read::read
    /// [`write`]: Write::write
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::fs::File;
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let f = File::create("foo.txt")?;
    ///     f.lock()?;
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "file_lock", since = "1.89.0")]
    pub fn lock(&self) -> io::Result<()> {
        self.inner.lock()
    }

    /// 获取文件的共享（非独占）锁。会阻塞直到能够获取锁。
    ///
    /// 此函数获取共享锁。同一文件或任何其他进程中的多个文件句柄可能持有共享锁，但没有任何其他文件句柄可能同时持有独占锁。
    /// 如果此文件句柄/描述符或其克隆已经持有锁，具体行为
    /// 未指定且依赖于平台，包括可能导致死锁的可能性。然而，如果此方法返回，则持有共享锁。
    /// If this file handle/descriptor, or a clone of it, already holds a lock, the exact
    /// behavior is unspecified and platform dependent, including the possibility that it will
    /// 导致非锁持有者阻塞。
    ///
    /// This lock may be advisory or mandatory. This lock is meant to interact with [`lock`],
    /// [`try_lock`], [`lock_shared`], [`try_lock_shared`], and [`unlock`]. Its interactions with
    /// other methods, such as [`read`] and [`write`] are platform specific, and it may or may not
    /// cause non-lockholders to block.
    ///
    /// The lock will be released when this file (along with any other file descriptors/handles
    /// duplicated or inherited from it) is closed, or if the [`unlock`] method is called.
    ///
    /// # 在 Windows 上，如果文件仅用于追加操作，则锁定文件会失败。要锁定文件，
    ///
    /// This function currently corresponds to the `flock` function on Unix with the `LOCK_SH` flag,
    /// and the `LockFileEx` function on Windows. Note that, this
    /// 尝试获取文件的独占锁。
    ///
    /// 如果此文件上已经持有其他锁
    /// open it with one of `.read(true)`, `.read(true).append(true)`, or `.write(true)`.
    ///
    /// [changes]: io#platform-specific-behavior
    ///
    /// [`lock`]: File::lock
    /// [`lock_shared`]: File::lock_shared
    /// [`try_lock`]: File::try_lock
    /// [`try_lock_shared`]: File::try_lock_shared
    /// [`unlock`]: File::unlock
    /// [`read`]: Read::read
    /// [`write`]: Write::write
    ///
    /// # 此函数获取独占锁；同一文件或任何其他进程中的其他文件句柄无法获取其他锁。
    ///
    /// ```no_run
    /// use std::fs::File;
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let f = File::open("foo.txt")?;
    ///     f.lock_shared()?;
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "file_lock", since = "1.89.0")]
    pub fn lock_shared(&self) -> io::Result<()> {
        self.inner.lock_shared()
    }

    /// Try to acquire an exclusive lock on the file.
    ///
    /// Returns `Err(TryLockError::WouldBlock)` if a different lock is already held on this file
    /// 其他方法的交互取决于平台，可能也可能不会
    ///
    /// 导致非锁持有者阻塞。
    /// 当该文件（以及任何其他文件描述符/句柄
    ///
    /// This lock may be advisory or mandatory. This lock is meant to interact with [`lock`],
    /// [`try_lock`], [`lock_shared`], [`try_lock_shared`], and [`unlock`]. Its interactions with
    /// other methods, such as [`read`] and [`write`] are platform specific, and it may or may not
    /// 可能导致非锁持有者阻塞。
    ///
    /// 如果此文件句柄/描述符或其克隆已经持有锁，具体行为
    /// 未指定且依赖于平台，包括可能导致死锁的情况。
    /// However, if this method returns `Ok(())`, then it has acquired an exclusive lock.
    ///
    /// 如果文件未处于写入状态，此函数是否返回错误未指定。
    ///
    /// 当该文件（以及任何其他文件描述符/句柄
    /// duplicated or inherited from it) is closed, or if the [`unlock`] method is called.
    ///
    /// # 特定于平台的行为
    ///
    /// This function currently corresponds to the `flock` function on Unix with the `LOCK_EX` and
    /// `LOCK_NB` flags, and the `LockFileEx` function on Windows with the `LOCKFILE_EXCLUSIVE_LOCK`
    /// and `LOCKFILE_FAIL_IMMEDIATELY` flags. Note that, this
    /// [未来可能会发生变化][changes]。
    ///
    /// 在 Windows 上，如果文件仅以追加模式打开，则锁定文件将失败。要锁定文件，
    /// open it with one of `.read(true)`, `.read(true).append(true)`, or `.write(true)`.
    ///
    /// [changes]: io#platform-specific-behavior
    ///
    /// [`lock`]: File::lock
    /// [`lock_shared`]: File::lock_shared
    /// [`try_lock`]: File::try_lock
    /// [`try_lock_shared`]: File::try_lock_shared
    /// [`unlock`]: File::unlock
    /// [`read`]: Read::read
    /// [`write`]: Write::write
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::fs::{File, TryLockError};
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let f = File::create("foo.txt")?;
    ///     // Explicit handling of the WouldBlock error
    ///     match f.try_lock() {
    ///         Ok(_) => (),
    ///         Err(TryLockError::WouldBlock) => (), // Lock not acquired
    ///         Err(TryLockError::Error(err)) => return Err(err),
    ///     }
    ///     // Alternately, propagate the error as an io::Error
    ///     f.try_lock()?;
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "file_lock", since = "1.89.0")]
    pub fn try_lock(&self) -> Result<(), TryLockError> {
        self.inner.try_lock()
    }

    /// 尝试获取文件的共享（非独占）锁。
    ///
    /// Returns `Err(TryLockError::WouldBlock)` if a different lock is already held on this file
    /// (via another handle/descriptor).
    ///
    /// 这将获取共享锁；同一进程或其他进程中的多个文件句柄可能
    /// 持有共享锁，但同时没有一个可以持有独占锁。
    ///
    /// This lock may be advisory or mandatory. This lock is meant to interact with [`lock`],
    /// [`try_lock`], [`lock_shared`], [`try_lock_shared`], and [`unlock`]. Its interactions with
    /// other methods, such as [`read`] and [`write`] are platform specific, and it may or may not
    /// 可能导致非锁持有者阻塞。
    ///
    /// 如果此文件句柄或其克隆已经持有锁，具体行为未指定且依赖于平台，包括可能导致死锁的情况。
    /// unspecified and platform dependent, including the possibility that it will deadlock.
    /// However, if this method returns `Ok(())`, then it has acquired a shared lock.
    ///
    /// The lock will be released when this file (along with any other file descriptors/handles
    /// duplicated or inherited from it) is closed, or if the [`unlock`] method is called.
    ///
    /// # Platform-specific behavior
    ///
    /// This function currently corresponds to the `flock` function on Unix with the `LOCK_SH` and
    /// `LOCK_NB` flags, and the `LockFileEx` function on Windows with the
    /// `LOCKFILE_FAIL_IMMEDIATELY` flag. Note that, this
    /// [未来可能会发生变化][changes]。
    ///
    /// 在 Windows 上，如果文件仅用于追加操作，则锁定该文件会失败。要锁定文件，
    /// open it with one of `.read(true)`, `.read(true).append(true)`, or `.write(true)`.
    ///
    /// [changes]: io#platform-specific-behavior
    ///
    /// [`lock`]: File::lock
    /// [`lock_shared`]: File::lock_shared
    /// [`try_lock`]: File::try_lock
    /// [`try_lock_shared`]: File::try_lock_shared
    /// [`unlock`]: File::unlock
    /// [`read`]: Read::read
    /// [`write`]: Write::write
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::fs::{File, TryLockError};
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let f = File::open("foo.txt")?;
    ///     // Explicit handling of the WouldBlock error
    ///     match f.try_lock_shared() {
    ///         Ok(_) => (),
    ///         Err(TryLockError::WouldBlock) => (), // Lock not acquired
    ///         Err(TryLockError::Error(err)) => return Err(err),
    ///     }
    ///     // Alternately, propagate the error as an io::Error
    ///     f.try_lock_shared()?;
    ///
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "file_lock", since = "1.89.0")]
    pub fn try_lock_shared(&self) -> Result<(), TryLockError> {
        self.inner.try_lock_shared()
    }

    /// 释放文件上的所有锁。
    ///
    /// 当文件（以及任何其他文件描述符/句柄）被关闭时，所有锁都会被释放。此方法允许在不关闭文件的情况下释放锁。
    /// 如果当前没有通过此文件描述符/句柄持有锁，此方法可能会返回错误，
    /// 或者成功返回而无需采取任何行动。
    ///
    /// 如果当前没有通过此文件描述符/句柄持有锁，此方法可能会返回错误，
    /// 或者可能成功返回而不采取任何行动。
    ///
    /// # 平台特定行为
    ///
    /// This function currently corresponds to the `flock` function on Unix with the `LOCK_UN` flag,
    /// and the `UnlockFile` function on Windows. Note that, this
    /// [未来可能会发生变化][changes]。
    ///
    /// 在 Windows 上，如果文件仅用于追加操作，则锁定该文件会失败。要锁定文件，
    /// open it with one of `.read(true)`, `.read(true).append(true)`, or `.write(true)`.
    ///
    /// [changes]: io#platform-specific-behavior
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::fs::File;
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let f = File::open("foo.txt")?;
    ///     f.lock()?;
    ///     f.unlock()?;
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "file_lock", since = "1.89.0")]
    pub fn unlock(&self) -> io::Result<()> {
        self.inner.unlock()
    }

    /// Truncates or extends the underlying file, updating the size of
    /// this file to become `size`.
    ///
    /// If the `size` is less than the current file's size, then the file will
    /// be shrunk. If it is greater than the current file's size, then the file
    /// will be extended to `size` and have all of the intermediate data filled
    /// 末尾之后。
    ///
    /// 文件的光标不会改变。特别是，如果光标位于末尾，并且使用此操作缩小文件，则光标现在位于
    /// 末尾之后。
    /// # 错误
    ///
    /// # 如果文件未以写入模式打开，此函数将返回错误。
    ///
    /// This function will return an error if the file is not opened for writing.
    /// Also, [`std::io::ErrorKind::InvalidInput`](crate::io::ErrorKind::InvalidInput)
    /// # 示例
    /// the implementation specifics.
    ///
    /// # 查询关于底层文件的元数据。
    ///
    /// ```no_run
    /// use std::fs::File;
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let mut f = File::create("foo.txt")?;
    ///     f.set_len(10)?;
    ///     Ok(())
    /// }
    /// ```
    ///
    /// # 示例
    /// though it takes `&self` rather than `&mut self`.
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn set_len(&self, size: u64) -> io::Result<()> {
        self.inner.truncate(size)
    }

    /// Queries metadata about the underlying file.
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::fs::File;
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let mut f = File::open("foo.txt")?;
    ///     let metadata = f.metadata()?;
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn metadata(&self) -> io::Result<Metadata> {
        self.inner.file_attr().map(Metadata)
    }

    /// Creates a new `File` instance with a different OS handle referring to
    /// the same underlying system resource as the existing `File` instance.
    /// Reads, writes, and seeks will affect both `File` instances simultaneously.
    ///
    /// # Examples
    ///
    /// Creates two handles for a file named `foo.txt`:
    ///
    /// ```no_run
    /// use std::fs::File;
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let mut file = File::open("foo.txt")?;
    ///     let file_copy = file.try_clone()?;
    ///     Ok(())
    /// }
    /// ```
    ///
    /// Assuming there’s a file named `foo.txt` with contents `abcdef\n`, create
    /// two handles, seek one of them, and read the remaining bytes from the
    /// 其他处理方式：
    ///
    /// ```no_run
    /// use std::fs::File;
    /// use std::io::SeekFrom;
    /// use std::io::prelude::*;
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let mut file = File::open("foo.txt")?;
    ///     let mut file_copy = file.try_clone()?;
    ///
    ///     file.seek(SeekFrom::Start(3))?;
    ///
    ///     let mut contents = vec![];
    ///     file_copy.read_to_end(&mut contents)?;
    ///     assert_eq!(contents, b"def\n");
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "file_try_clone", since = "1.9.0")]
    pub fn try_clone(&self) -> io::Result<File> {
        Ok(File { inner: self.inner.duplicate()? })
    }

    /// 修改底层文件的权限。
    ///
    /// # 平台特定行为
    ///
    /// This function currently corresponds to the `fchmod` function on Unix and
    /// the `SetFileInformationByHandle` function on Windows. Note that, this
    /// [未来可能会发生变化][changes]。
    ///
    /// [changes]: io#platform-specific-behavior
    ///
    /// # 错误
    ///
    /// 如果用户没有权限修改底层文件的属性，此函数将返回错误。它也可能在其他
    /// 操作系统特定的未指定情况下返回错误。
    /// # 示例
    ///
    /// # 请注意，此方法会改变底层文件的权限，
    ///
    /// ```no_run
    /// fn main() -> std::io::Result<()> {
    ///     use std::fs::File;
    ///
    ///     let file = File::open("foo.txt")?;
    ///     let mut perms = file.metadata()?.permissions();
    ///     perms.set_readonly(true);
    ///     file.set_permissions(perms)?;
    ///     Ok(())
    /// }
    /// ```
    ///
    /// Note that this method alters the permissions of the underlying file,
    /// even though it takes `&self` rather than `&mut self`.
    #[doc(alias = "fchmod", alias = "SetFileInformationByHandle")]
    #[stable(feature = "set_permissions_atomic", since = "1.16.0")]
    pub fn set_permissions(&self, perm: Permissions) -> io::Result<()> {
        self.inner.set_permissions(perm.0)
    }

    /// 操作系统特定的未指定情况下返回错误。
    ///
    /// # 平台特定行为
    ///
    /// This function currently corresponds to the `futimens` function on Unix (falling back to
    /// `futimes` on macOS before 10.13) and the `SetFileTime` function on Windows. Note that this
    /// [未来可能会发生变化][changes]。
    ///
    /// 在大多数平台上，包括 UNIX 和 Windows 平台，此函数还可以更改
    /// timestamps of a directory. To get a `File` representing a directory in order to call
    /// `set_times`, open the directory with `File::open` without attempting to obtain write
    /// 如果用户没有权限修改底层文件的时间戳，此函数将返回错误。它也可能在其他
    ///
    /// [changes]: io#platform-specific-behavior
    ///
    /// # 操作系统特定的未指定情况下返回错误。
    ///
    /// This function will return an error if the user lacks permission to change timestamps on the
    /// # 示例
    ///
    /// 此函数可能返回错误，如果操作系统不支持更改底层文件的时间戳。
    /// more of the timestamps set in the `FileTimes` structure.
    ///
    /// # 示例
    ///
    /// ```no_run
    /// fn main() -> std::io::Result<()> {
    ///     use std::fs::{self, File, FileTimes};
    ///
    ///     let src = fs::metadata("src")?;
    ///     let dest = File::open("dest")?;
    ///     let times = FileTimes::new()
    ///         .set_accessed(src.accessed()?)
    ///         .set_modified(src.modified()?);
    ///     dest.set_times(times)?;
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "file_set_times", since = "1.75.0")]
    #[doc(alias = "futimens")]
    #[doc(alias = "futimes")]
    #[doc(alias = "SetFileTime")]
    #[doc(alias = "filetime")]
    pub fn set_times(&self, times: FileTimes) -> io::Result<()> {
        self.inner.set_times(times.0)
    }

    /// 修改底层文件修改时间。
    ///
    /// This is an alias for `set_times(FileTimes::new().set_modified(time))`.
    #[stable(feature = "file_set_times", since = "1.75.0")]
    #[inline]
    pub fn set_modified(&self, time: SystemTime) -> io::Result<()> {
        self.set_times(FileTimes::new().set_modified(time))
    }
}

// In addition to the `impl`s here, `File` also has `impl`s for
// `AsFd`/`From<OwnedFd>`/`Into<OwnedFd>` and
// `AsRawFd`/`IntoRawFd`/`FromRawFd`, on Unix and WASI, and
// `AsHandle`/`From<OwnedHandle>`/`Into<OwnedHandle>` and
// `AsRawHandle`/`IntoRawHandle`/`FromRawHandle` on Windows.

impl AsInner<fs_imp::File> for File {
    #[inline]
    fn as_inner(&self) -> &fs_imp::File {
        &self.inner
    }
}
impl FromInner<fs_imp::File> for File {
    fn from_inner(f: fs_imp::File) -> File {
        File { inner: f }
    }
}
impl IntoInner<fs_imp::File> for File {
    fn into_inner(self) -> fs_imp::File {
        self.inner
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl fmt::Debug for File {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.inner.fmt(f)
    }
}

/// 指示读取文件剩余部分所需的额外容量。
fn buffer_capacity_required(mut file: &File) -> Option<usize> {
    let size = file.metadata().map(|m| m.len()).ok()?;
    let pos = file.stream_position().ok()?;
    // Don't worry about `usize` overflow because reading will fail regardless
    // in that case.
    Some(size.saturating_sub(pos) as usize)
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Read for &File {
    /// 从文件中读取一些字节。
    ///
    /// See [`Read::read`] docs for more info.
    ///
    /// # 平台特定行为
    ///
    /// This function currently corresponds to the `read` function on Unix and
    /// the `NtReadFile` function on Windows. Note that this [may change in
    /// [changes]。
    ///
    /// [changes]: io#platform-specific-behavior
    #[inline]
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        self.inner.read(buf)
    }

    /// Like `read`, except that it reads into a slice of buffers.
    ///
    /// See [`Read::read_vectored`] docs for more info.
    ///
    /// # 平台特定行为
    ///
    /// This function currently corresponds to the `readv` function on Unix and
    /// falls back to the `read` implementation on Windows. Note that this
    /// [未来可能会发生变化][changes]。
    ///
    /// [changes]: io#platform-specific-behavior
    #[inline]
    fn read_vectored(&mut self, bufs: &mut [IoSliceMut<'_>]) -> io::Result<usize> {
        self.inner.read_vectored(bufs)
    }

    #[inline]
    fn read_buf(&mut self, cursor: BorrowedCursor<'_, u8>) -> io::Result<()> {
        self.inner.read_buf(cursor)
    }

    /// Determines if `File` has an efficient `read_vectored` implementation.
    ///
    /// See [`Read::is_read_vectored`] docs for more info.
    ///
    /// # 平台特定行为
    ///
    /// This function currently returns `true` on Unix and `false` on Windows.
    /// 请注意，此行为[未来可能会改变][changes]。
    ///
    /// [changes]: io#platform-specific-behavior
    #[inline]
    fn is_read_vectored(&self) -> bool {
        self.inner.is_read_vectored()
    }

    // Reserves space in the buffer based on the file size when available.
    fn read_to_end(&mut self, buf: &mut Vec<u8>) -> io::Result<usize> {
        let size = buffer_capacity_required(self);
        buf.try_reserve(size.unwrap_or(0))?;
        io::default_read_to_end(self, buf, size)
    }

    // Reserves space in the buffer based on the file size when available.
    fn read_to_string(&mut self, buf: &mut String) -> io::Result<usize> {
        let size = buffer_capacity_required(self);
        buf.try_reserve(size.unwrap_or(0))?;
        io::default_read_to_string(self, buf, size)
    }
}
#[stable(feature = "rust1", since = "1.0.0")]
impl Write for &File {
    /// 向文件中写入一些字节。
    ///
    /// See [`Write::write`] docs for more info.
    ///
    /// # 平台特定行为
    ///
    /// This function currently corresponds to the `write` function on Unix and
    /// the `NtWriteFile` function on Windows. Note that this [may change in
    /// [未来可能会改变][changes]。
    ///
    /// [changes]: io#platform-specific-behavior
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.inner.write(buf)
    }

    /// Like `write`, except that it writes into a slice of buffers.
    ///
    /// See [`Write::write_vectored`] docs for more info.
    ///
    /// # 平台特定行为
    ///
    /// This function currently corresponds to the `writev` function on Unix
    /// and falls back to the `write` implementation on Windows. Note that this
    /// [未来可能会改变][changes]。
    ///
    /// [changes]: io#platform-specific-behavior
    fn write_vectored(&mut self, bufs: &[IoSlice<'_>]) -> io::Result<usize> {
        self.inner.write_vectored(bufs)
    }

    /// Determines if `File` has an efficient `write_vectored` implementation.
    ///
    /// See [`Write::is_write_vectored`] docs for more info.
    ///
    /// # 平台特定行为
    ///
    /// This function currently returns `true` on Unix and `false` on Windows.
    /// 请注意，此行为[未来可能会改变][changes]。
    ///
    /// [changes]: io#platform-specific-behavior
    #[inline]
    fn is_write_vectored(&self) -> bool {
        self.inner.is_write_vectored()
    }

    /// 刷新文件，确保所有中间缓冲的内容
    /// 都能到达目标位置。
    ///
    /// See [`Write::flush`] docs for more info.
    ///
    /// # 平台特定行为
    ///
    /// Since a `File` structure doesn't contain any buffers, this function is
    /// 在 Unix 和 Windows 系统下当前是无操作的。请注意，此行为[未来可能会改变]。
    /// [未来可能会改变][changes]。
    ///
    /// [changes]: io#platform-specific-behavior
    #[inline]
    fn flush(&mut self) -> io::Result<()> {
        self.inner.flush()
    }
}
#[stable(feature = "rust1", since = "1.0.0")]
impl Seek for &File {
    /// 在文件中按字节偏移量定位。
    ///
    /// See [`Seek::seek`] docs for more info.
    ///
    /// # 平台特定行为
    ///
    /// This function currently corresponds to the `lseek64` function on Unix
    /// and the `SetFilePointerEx` function on Windows. Note that this [may
    /// 改变。[未来可能会改变]。
    ///
    /// [changes]: io#platform-specific-behavior
    fn seek(&mut self, pos: SeekFrom) -> io::Result<u64> {
        self.inner.seek(pos)
    }

    /// 返回该文件的长度（以字节为单位）。
    ///
    /// See [`Seek::stream_len`] docs for more info.
    ///
    /// # 平台特定行为
    ///
    /// This function currently corresponds to the `statx` function on Linux
    /// (with fallbacks) and the `GetFileSizeEx` function on Windows. Note that
    /// 此行为[未来可能会改变][changes]。
    ///
    /// [changes]: io#platform-specific-behavior
    fn stream_len(&mut self) -> io::Result<u64> {
        if let Some(result) = self.inner.size() {
            return result;
        }
        io::stream_len_default(self)
    }

    fn stream_position(&mut self) -> io::Result<u64> {
        self.inner.tell()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Read for File {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        (&*self).read(buf)
    }
    fn read_vectored(&mut self, bufs: &mut [IoSliceMut<'_>]) -> io::Result<usize> {
        (&*self).read_vectored(bufs)
    }
    fn read_buf(&mut self, cursor: BorrowedCursor<'_, u8>) -> io::Result<()> {
        (&*self).read_buf(cursor)
    }
    #[inline]
    fn is_read_vectored(&self) -> bool {
        (&self).is_read_vectored()
    }
    fn read_to_end(&mut self, buf: &mut Vec<u8>) -> io::Result<usize> {
        (&*self).read_to_end(buf)
    }
    fn read_to_string(&mut self, buf: &mut String) -> io::Result<usize> {
        (&*self).read_to_string(buf)
    }
}
#[stable(feature = "rust1", since = "1.0.0")]
impl Write for File {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        (&*self).write(buf)
    }
    fn write_vectored(&mut self, bufs: &[IoSlice<'_>]) -> io::Result<usize> {
        (&*self).write_vectored(bufs)
    }
    #[inline]
    fn is_write_vectored(&self) -> bool {
        (&self).is_write_vectored()
    }
    #[inline]
    fn flush(&mut self) -> io::Result<()> {
        (&*self).flush()
    }
}
#[stable(feature = "rust1", since = "1.0.0")]
impl Seek for File {
    fn seek(&mut self, pos: SeekFrom) -> io::Result<u64> {
        (&*self).seek(pos)
    }
    fn stream_len(&mut self) -> io::Result<u64> {
        (&*self).stream_len()
    }
    fn stream_position(&mut self) -> io::Result<u64> {
        (&*self).stream_position()
    }
}
#[doc(hidden)]
#[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
impl crate::io::IoHandle for File {}

impl Dir {
    /// Attempts to open a directory at `path` in read-only mode.
    ///
    /// This function opens a directory. To open a file instead, see [`File::open`].
    ///
    /// # 错误
    ///
    /// This function will return an error if `path` does not point to an existing directory.
    /// Other errors may also be returned according to [`OpenOptions::open`].
    ///
    /// # 示例
    ///
    /// ```no_run
    /// #![feature(dirfd)]
    /// use std::{fs::Dir, io};
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let dir = Dir::open("foo")?;
    ///     let mut f = dir.open_file("bar.txt")?;
    ///     let contents = io::read_to_string(f)?;
    ///     assert_eq!(contents, "Hello, world!");
    ///     Ok(())
    /// }
    /// ```
    #[unstable(feature = "dirfd", issue = "120426")]
    pub fn open<P: AsRef<Path>>(path: P) -> io::Result<Self> {
        fs_imp::Dir::open(path.as_ref(), &OpenOptions::new().read(true).0)
            .map(|inner| Self { inner })
    }

    /// Attempts to open a directory at `path` according to `opts`.
    ///
    /// This function opens a directory. To open a file instead, see [`File::open`].
    ///
    /// # 错误
    ///
    /// This function will return an error if `path` does not point to an existing directory.
    /// Other errors may also be returned according to [`OpenOptions::open`].
    ///
    /// # 示例
    ///
    /// ```no_run
    /// #![feature(dirfd)]
    /// use std::{fs::{Dir, OpenOptions}, io};
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let dir = Dir::open_with("foo", &OpenOptions::new().read(true))?;
    ///     let mut f = dir.open_file("bar.txt")?;
    ///     let contents = io::read_to_string(f)?;
    ///     assert_eq!(contents, "Hello, world!");
    ///     Ok(())
    /// }
    /// ```
    #[unstable(feature = "dirfd", issue = "120426")]
    pub fn open_with<P: AsRef<Path>>(path: P, opts: &OpenOptions) -> io::Result<Self> {
        fs_imp::Dir::open(path.as_ref(), &opts.0).map(|inner| Self { inner })
    }

    /// Attempts to open a directory at `path` with the minimum permissions for traversal.
    ///
    /// 该函数要求的权限足以打开子文件或子文件夹，但不一定能列出所有子项。
    /// # 错误
    ///
    /// # Errors
    ///
    /// This function may return an error according to [`OpenOptions::open`].
    ///
    /// # 示例
    ///
    /// ```no_run
    /// #![feature(dirfd)]
    /// use std::{fs::Dir, io};
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let foo = Dir::open_for_traversal("foo")?;
    ///     let foobar = foo.open_dir("bar")?;
    ///     let mut foobarbaz = foobar.open_file("baz")?;
    ///     let contents = io::read_to_string(foobarbaz)?;
    ///     assert_eq!(contents, "Hello, world!");
    ///     Ok(())
    /// }
    /// ```
    #[unstable(feature = "dirfd", issue = "120426")]
    pub fn open_for_traversal<P: AsRef<Path>>(path: P) -> io::Result<Self> {
        fs_imp::Dir::open_for_traversal(path.as_ref()).map(|inner| Self { inner })
    }

    /// 查询底层目录的元数据。
    ///
    /// This is equivalent to `dir.metadata(".")` but can be more efficient.
    ///
    /// # 示例
    ///
    /// ```no_run
    /// #![feature(dirfd)]
    /// use std::fs::Dir;
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let dir = Dir::open("foo")?;
    ///     let metadata = dir.self_metadata()?;
    ///     Ok(())
    /// }
    /// ```
    #[unstable(feature = "dirfd", issue = "120426")]
    pub fn self_metadata(&self) -> io::Result<Metadata> {
        self.inner.self_metadata().map(Metadata)
    }

    /// 尝试以只读模式打开相对于此目录的文件。
    ///
    /// This function interprets `path` relative to the directory provided by `self`. To open a file
    /// relative to the current working directory, or at an absolute path, see [`File::open`].
    ///
    /// # 错误
    ///
    /// This function will return an error if `path` does not point to an existing file.
    /// Other errors may also be returned according to [`OpenOptions::open`].
    ///
    /// # 示例
    ///
    /// ```no_run
    /// #![feature(dirfd)]
    /// use std::{fs::Dir, io};
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let dir = Dir::open("foo")?;
    ///     let mut f = dir.open_file("bar.txt")?;
    ///     let contents = io::read_to_string(f)?;
    ///     assert_eq!(contents, "Hello, world!");
    ///     Ok(())
    /// }
    /// ```
    #[unstable(feature = "dirfd", issue = "120426")]
    pub fn open_file<P: AsRef<Path>>(&self, path: P) -> io::Result<File> {
        self.inner
            .open_file(path.as_ref(), &OpenOptions::new().read(true).0)
            .map(|f| File { inner: f })
    }

    /// Attempts to open a file according to `opts` relative to this directory.
    ///
    /// This function interprets `path` relative to the directory provided by `self`. To open a file
    /// relative to the current working directory, or at an absolute path, see [`File::open`].
    ///
    /// # 错误
    ///
    /// This function will return an error if `path` does not point to an existing file.
    /// Other errors may also be returned according to [`OpenOptions::open`].
    ///
    /// # 示例
    ///
    /// ```no_run
    /// #![feature(dirfd)]
    /// use std::{fs::{Dir, OpenOptions}, io::{self, Write}};
    ///
    /// fn main() -> io::Result<()> {
    ///     let dir = Dir::open("foo")?;
    ///     let mut opts = OpenOptions::new();
    ///     opts.read(true).write(true);
    ///     let mut f = dir.open_file_with("bar.txt", &opts)?;
    ///     f.write_all(b"Hello, world!")?;
    ///     let contents = io::read_to_string(f)?;
    ///     assert_eq!(contents, "Hello, world!");
    ///     Ok(())
    /// }
    /// ```
    #[unstable(feature = "dirfd", issue = "120426")]
    pub fn open_file_with<P: AsRef<Path>>(&self, path: P, opts: &OpenOptions) -> io::Result<File> {
        self.inner.open_file(path.as_ref(), &opts.0).map(|f| File { inner: f })
    }

    /// 尝试移除相对于此目录的文件。
    ///
    /// This function interprets `path` relative to the directory provided by `self`. To remove a file
    /// relative to the current working directory, or at an absolute path, see [`fs::remove_file`][remove_file].
    ///
    /// # 错误
    ///
    /// This function will return an error if `path` does not point to an existing file.
    /// Other errors may also be returned according to [`OpenOptions::open`].
    ///
    /// # 示例
    ///
    /// ```no_run
    /// #![feature(dirfd)]
    /// use std::fs::Dir;
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let dir = Dir::open("foo")?;
    ///     dir.remove_file("bar.txt")?;
    ///     Ok(())
    /// }
    /// ```
    #[unstable(feature = "dirfd", issue = "120426")]
    pub fn remove_file<P: AsRef<Path>>(&self, path: P) -> io::Result<()> {
        self.inner.remove_file(path.as_ref())
    }

    /// 尝试将相对于此目录的文件或目录重命名为新名称，并替换
    /// 如果存在的话，目标文件。
    ///
    /// This function interprets `from` relative to the directory provided by `self` and `to` relative to the directory
    /// provided by `to_dir`. To rename a file relative to the current working directory, or at an absolute path, see [`fs::rename`][rename].
    ///
    /// # Errors
    ///
    /// This function will return an error if `from` does not point to an existing file or directory.
    /// Other errors may also be returned according to [`OpenOptions::open`].
    ///
    /// # 示例
    ///
    /// ```no_run
    /// #![feature(dirfd)]
    /// use std::fs::Dir;
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let dir = Dir::open("foo")?;
    ///     dir.rename("bar.txt", &dir, "quux.txt")?;
    ///     Ok(())
    /// }
    /// ```
    #[unstable(feature = "dirfd", issue = "120426")]
    pub fn rename<P: AsRef<Path>, Q: AsRef<Path>>(
        &self,
        from: P,
        to_dir: &Self,
        to: Q,
    ) -> io::Result<()> {
        self.inner.rename(from.as_ref(), &to_dir.inner, to.as_ref())
    }

    /// 尝试创建相对于此目录的目录。
    ///
    /// This function interprets `path` relative to the directory provided by `self`. To create a directory
    /// 相对于当前工作目录的目录，或绝对路径，请参见
    /// [`fs::create_dir`][crate::fs::create_dir].
    #[unstable(feature = "dirfd", issue = "120426")]
    pub fn create_dir<P: AsRef<Path>>(&self, path: P) -> io::Result<()> {
        self.inner.create_dir(path.as_ref())
    }

    /// 尝试以只读模式打开相对于此目录的目录。
    ///
    /// This function interprets `path` relative to the directory provided by `self`. To open a directory
    /// relative to the current working directory, or at an absolute path, see [`Dir::open`].
    ///
    /// # 错误
    ///
    /// This function will return an error if `path` does not point to an existing directory.
    /// Other errors may also be returned according to [`OpenOptions::open`].
    ///
    /// # 示例
    ///
    /// ```no_run
    /// #![feature(dirfd)]
    /// use std::{fs::Dir};
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let dir = Dir::open("foo")?;
    ///     let foobar = dir.open_dir("bar")?;
    ///     Ok(())
    /// }
    /// ```
    #[unstable(feature = "dirfd", issue = "120426")]
    pub fn open_dir<P: AsRef<Path>>(&self, path: P) -> io::Result<Self> {
        self.inner
            .open_dir(path.as_ref(), &OpenOptions::new().read(true).0)
            .map(|inner| Self { inner })
    }

    /// Attempts to open a directory relative to this directory according to `opts`.
    ///
    /// This function interprets `path` relative to the directory provided by `self`. To open a directory
    /// relative to the current working directory, or at an absolute path, see [`Dir::open`].
    ///
    /// # 错误
    ///
    /// This function will return errors according to [`OpenOptions::open`].
    ///
    /// # 示例
    ///
    /// ```no_run
    /// #![feature(dirfd)]
    /// use std::fs::{Dir, OpenOptions};
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let dir = Dir::open("foo")?;
    ///     let foobar_w = dir.open_dir_with("bar", &OpenOptions::new().write(true))?;
    ///     Ok(())
    /// }
    /// ```
    #[unstable(feature = "dirfd", issue = "120426")]
    pub fn open_dir_with<P: AsRef<Path>>(&self, path: P, opts: &OpenOptions) -> io::Result<Self> {
        self.inner.open_dir(path.as_ref(), &opts.0).map(|inner| Self { inner })
    }

    /// 尝试删除相对于此目录的目录。
    ///
    /// This function interprets `path` relative to the directory provided by `self`. To remove a directory
    /// 相对于当前工作目录的目录，或绝对路径，请参见
    /// [`fs::remove_dir`][crate::fs::remove_dir].
    ///
    /// # 错误
    ///
    /// This function will return an error if `path` does not point to an existing directory.
    /// Other errors may also be returned according to [`OpenOptions::open`].
    ///
    /// # 示例
    ///
    /// ```no_run
    /// #![feature(dirfd)]
    /// use std::{fs::Dir};
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let dir = Dir::open("foo")?;
    ///     dir.remove_dir("bar")?;
    ///     Ok(())
    /// }
    /// ```
    #[unstable(feature = "dirfd", issue = "120426")]
    pub fn remove_dir<P: AsRef<Path>>(&self, path: P) -> io::Result<()> {
        self.inner.remove_dir(path.as_ref())
    }

    /// Creates a new `Dir` instance that shares the same underlying directory handle
    /// as the existing `Dir` instance.
    ///
    /// # 示例
    ///
    /// Creates two handles for a directory named `foo`:
    ///
    /// ```no_run
    /// #![feature(dirfd)]
    /// use std::fs::Dir;
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let dir = Dir::open("foo")?;
    ///     let dir_copy = dir.try_clone()?;
    ///     Ok(())
    /// }
    /// ```
    #[unstable(feature = "dirfd", issue = "120426")]
    pub fn try_clone(&self) -> io::Result<Self> {
        Ok(Dir { inner: self.inner.duplicate()? })
    }

    /// 查询文件系统以获取关于相对于此
    /// 目录的文件、目录等信息。
    ///
    /// 此函数将遍历符号链接以查询目标文件的信息。
    /// 要查询路径本身的元数据而不跟随符号链接，请使用
    /// [`symlink_metadata`][Self::symlink_metadata].
    ///
    /// # 示例
    ///
    /// ```no_run
    /// #![feature(dirfd)]
    /// use std::fs::Dir;
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let dir = Dir::open("foo")?;
    ///     let metadata = dir.metadata("subdir/file.txt")?;
    ///     Ok(())
    /// }
    /// ```
    #[unstable(feature = "dirfd", issue = "120426")]
    pub fn metadata<P: AsRef<Path>>(&self, path: P) -> io::Result<Metadata> {
        self.inner.metadata(path.as_ref()).map(Metadata)
    }

    /// 查询文件系统以获取关于相对于此
    /// 目录的文件、目录等信息。
    ///
    /// This function will return the [`Metadata`] of the exact path without traversing symbolic
    /// 链接到解析后的目标文件。对文件或路径使用此函数时
    /// directory (not a symbolic link) will behave the same as [`metadata`][Self::metadata].
    ///
    /// # 示例
    ///
    /// ```no_run
    /// #![feature(dirfd)]
    /// use std::fs::Dir;
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let dir = Dir::open("foo")?;
    ///     let metadata = dir.symlink_metadata("subdir/file.txt")?;
    ///     Ok(())
    /// }
    /// ```
    #[unstable(feature = "dirfd", issue = "120426")]
    pub fn symlink_metadata<P: AsRef<Path>>(&self, path: P) -> io::Result<Metadata> {
        self.inner.symlink_metadata(path.as_ref()).map(Metadata)
    }
}

impl AsInner<fs_imp::Dir> for Dir {
    #[inline]
    fn as_inner(&self) -> &fs_imp::Dir {
        &self.inner
    }
}
impl FromInner<fs_imp::Dir> for Dir {
    fn from_inner(f: fs_imp::Dir) -> Dir {
        Dir { inner: f }
    }
}
impl IntoInner<fs_imp::Dir> for Dir {
    fn into_inner(self) -> fs_imp::Dir {
        self.inner
    }
}

#[unstable(feature = "dirfd", issue = "120426")]
impl fmt::Debug for Dir {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.inner.fmt(f)
    }
}

impl OpenOptions {
    /// 创建一个空白的新选项集，可供配置使用。
    ///
    /// All options are initially set to `false`.
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::fs::OpenOptions;
    ///
    /// let mut options = OpenOptions::new();
    /// let file = options.read(true).open("foo.txt");
    /// ```
    #[cfg_attr(not(test), rustc_diagnostic_item = "open_options_new")]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    pub fn new() -> Self {
        OpenOptions(fs_imp::OpenOptions::new())
    }

    /// 设置读取访问选项。
    ///
    /// 当此选项为 true 时，表示文件在打开时应为
    /// `read`-able if opened.
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::fs::OpenOptions;
    ///
    /// let file = OpenOptions::new().read(true).open("foo.txt");
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn read(&mut self, read: bool) -> &mut Self {
        self.0.read(read);
        self
    }

    /// 设置写入访问选项。
    ///
    /// 当此选项为 true 时，表示文件在打开时应为
    /// `write`-able if opened.
    ///
    /// 如果文件已存在，对其的任何写入操作将覆盖其
    /// 内容，而不会将其截断。
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::fs::OpenOptions;
    ///
    /// let file = OpenOptions::new().write(true).open("foo.txt");
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn write(&mut self, write: bool) -> &mut Self {
        self.0.write(write);
        self
    }

    /// 设置追加模式选项。
    ///
    /// 当此选项为 true 时，意味着写入内容将追加到文件中，而不是覆盖
    /// previous contents. The `write` setting is ignored when `append` is true, i.e.,
    /// `.write(true).append(true).open(...)` has the same effect as `.append(true).open(...)`.
    ///
    /// 追加模式确保写入内容位于文件的当前末尾位置，
    /// 即使有其他进程或线程正在向同一文件追加内容也是如此。这是
    /// a race-free version of <code>[seek]\([SeekFrom]::[End]\(0))</code> followed by `write()`,
    /// 即使存在并发写入者也能正确工作。
    ///
    /// Keep in mind that this does not necessarily guarantee that data appended by
    /// different processes or threads does not interleave. The amount of data accepted a
    /// single `write()` call depends on the operating system and file system. A
    /// successful `write()` is allowed to write only part of the given data, so even if
    /// you're careful to provide the whole message in a single call to `write()`, there
    /// is no guarantee that it will be written out in full. If you rely on the filesystem
    /// ## 注意
    /// 如果文件不存在，此函数不会创建它。应使用
    /// before passing them to [`write()`].
    ///
    /// # 示例
    /// 设置截断之前文件的选项。
    /// 设置截断之前文件的选项。
    /// <code>[Seek]::[stream_position]</code>), and restore it before the next read.
    ///
    /// ## Note
    ///
    /// This function doesn't create the file if it doesn't exist. Use the
    /// [`OpenOptions::create`] method to do so.
    ///
    /// [`write()`]: Write::write "io::Write::write"
    /// [`flush()`]: Write::flush "io::Write::flush"
    /// [stream_position]: Seek::stream_position "io::Seek::stream_position"
    /// [seek]: Seek::seek "io::Seek::seek"
    /// [Current]: SeekFrom::Current "io::SeekFrom::Current"
    /// [End]: SeekFrom::End "io::SeekFrom::End"
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use std::fs::OpenOptions;
    ///
    /// let file = OpenOptions::new().append(true).open("foo.txt");
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn append(&mut self, append: bool) -> &mut Self {
        self.0.append(append);
        self
    }

    /// Sets the option for truncating a previous file.
    ///
    /// 如果以 true 设置该选项成功打开文件，则会将文件截断为 0 字节长度（如果文件已存在）。
    /// 如果文件已存在，则将其截断为 0 字节长度。
    ///
    /// 要执行截断操作，必须以可写入的方式打开文件。
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::fs::OpenOptions;
    ///
    /// let file = OpenOptions::new().write(true).truncate(true).open("foo.txt");
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn truncate(&mut self, truncate: bool) -> &mut Self {
        self.0.truncate(truncate);
        self
    }

    /// 设置该选项以创建新文件，或如果文件已存在则打开它。
    ///
    /// In order for the file to be created, [`OpenOptions::write`] or
    /// [`OpenOptions::append`] access must be used.
    ///
    /// See also [`std::fs::write()`][self::write] for a simple function to
    /// 根据给定数据创建文件。
    ///
    /// # 错误
    ///
    /// If `.create(true)` is set without `.write(true)` or `.append(true)`,
    /// calling [`open`](Self::open) will fail with [`InvalidInput`](io::ErrorKind::InvalidInput) error.
    /// # 示例
    ///
    /// ```no_run
    /// use std::fs::OpenOptions;
    ///
    /// let file = OpenOptions::new().write(true).create(true).open("foo.txt");
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn create(&mut self, create: bool) -> &mut Self {
        self.0.create(create);
        self
    }

    /// 设置该选项以创建新文件，如果文件已存在则失败。
    ///
    /// 目标位置不能存在任何文件，也不能有（悬空）符号链接。通过这种方式，如果调用成功，返回的文件保证是新的。
    /// way, if the call succeeds, the file returned is guaranteed to be new.
    /// If a file exists at the target location, creating a new file will fail with [`AlreadyExists`]
    /// or another error based on the situation. See [`OpenOptions::open`] for a
    /// 文件是否存在和创建新文件之间，文件可能被
    ///
    /// 另一个进程创建（[TOCTOU] 竞争条件/攻击）。
    /// whether a file exists and creating a new one, the file may have been
    /// 要创建新文件，必须以可写入或追加方式打开文件。
    ///
    /// If `.create_new(true)` is set, [`.create()`] and [`.truncate()`] are
    /// ignored.
    ///
    /// # 错误
    /// 此函数在多种不同情况下会返回错误。其中一些错误情况在此列出，
    ///
    /// [`.create()`]: OpenOptions::create
    /// [`.truncate()`]: OpenOptions::truncate
    /// [`AlreadyExists`]: io::ErrorKind::AlreadyExists
    /// [TOCTOU]: self#time-of-check-to-time-of-use-toctou
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use std::fs::OpenOptions;
    ///
    /// let file = OpenOptions::new().write(true)
    ///                              .create_new(true)
    ///                              .open("foo.txt");
    /// ```
    #[stable(feature = "expand_open_options2", since = "1.9.0")]
    pub fn create_new(&mut self, create_new: bool) -> &mut Self {
        self.0.create_new(create_new);
        self
    }

    /// Opens a file at `path` with the options specified by `self`.
    ///
    /// # Errors
    ///
    /// This function will return an error under a number of different
    /// circumstances. Some of these error conditions are listed here, together
    /// with their [`io::ErrorKind`]. The mapping to [`io::ErrorKind`]s is not
    /// 访问权限。
    ///
    /// * [`NotFound`]: The specified file does not exist and neither `create`
    ///   or `create_new` is set.
    /// * [`NotFound`]: One of the directory components of the file path does
    ///   not exist.
    /// * [`PermissionDenied`]: The user lacks permission to get the specified
    /// access rights for the file.
    /// * [`PermissionDenied`]: The user lacks permission to open one of the
    /// directory components of the specified path.
    /// * [`AlreadyExists`]: `create_new` was specified and the file already
    /// exists.
    /// * [`InvalidInput`]: Invalid combinations of open options (truncate
    /// without write access, create without write or append access,
    /// no access mode set, etc.).
    ///
    /// The following errors don't match any existing [`io::ErrorKind`] at the moment:
    /// * 指定文件路径中的目录组件之一
    /// 实际上并非一个目录。
    /// * 文件系统级别的错误：磁盘已满、写入权限问题
    /// 在只读文件系统中请求时，超出了磁盘配额，打开的文件过多
    /// 文件名过长，路径中包含过多的符号链接（仅限类 Unix 系统）
    /// 等。
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::fs::OpenOptions;
    ///
    /// let file = OpenOptions::new().read(true).open("foo.txt");
    /// ```
    ///
    /// [`AlreadyExists`]: io::ErrorKind::AlreadyExists
    /// [`InvalidInput`]: io::ErrorKind::InvalidInput
    /// [`NotFound`]: io::ErrorKind::NotFound
    /// [`PermissionDenied`]: io::ErrorKind::PermissionDenied
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn open<P: AsRef<Path>>(&self, path: P) -> io::Result<File> {
        self._open(path.as_ref())
    }

    fn _open(&self, path: &Path) -> io::Result<File> {
        fs_imp::File::open(path, &self.0).map(|inner| File { inner })
    }
}

impl AsInner<fs_imp::OpenOptions> for OpenOptions {
    #[inline]
    fn as_inner(&self) -> &fs_imp::OpenOptions {
        &self.0
    }
}

impl AsInnerMut<fs_imp::OpenOptions> for OpenOptions {
    #[inline]
    fn as_inner_mut(&mut self) -> &mut fs_imp::OpenOptions {
        &mut self.0
    }
}

impl Metadata {
    /// 返回此元数据的文件类型。
    ///
    /// # 示例
    ///
    /// ```no_run
    /// fn main() -> std::io::Result<()> {
    ///     use std::fs;
    ///
    ///     let metadata = fs::metadata("foo.txt")?;
    ///
    ///     println!("{:?}", metadata.file_type());
    ///     Ok(())
    /// }
    /// ```
    #[must_use]
    #[stable(feature = "file_type", since = "1.1.0")]
    pub fn file_type(&self) -> FileType {
        FileType(self.0.file_type())
    }

    /// Returns `true` if this metadata is for a directory. The result is mutually exclusive to the
    /// result of [`Metadata::is_file`] and [`Metadata::is_symlink`] (i.e., at most one of these
    /// three methods returns `true`).
    ///
    /// # Examples
    ///
    /// ```no_run
    /// fn main() -> std::io::Result<()> {
    ///     use std::fs;
    ///
    ///     let metadata = fs::metadata("foo.txt")?;
    ///
    ///     assert!(!metadata.is_dir());
    ///     Ok(())
    /// }
    /// ```
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn is_dir(&self) -> bool {
        self.file_type().is_dir()
    }

    /// Returns `true` if this metadata is for a regular file. The result is mutually exclusive to
    /// the result of [`Metadata::is_dir`] and [`Metadata::is_symlink`] (i.e., at most one of these
    /// three methods returns `true`).
    ///
    /// When the goal is simply to read from (or write to) the source, the most
    /// # 示例
    /// it. Only using `is_file` can break workflows like `diff <( prog_a )` on
    /// a Unix-like system for example. See [`File::open`] or
    /// [`OpenOptions::open`] for more information.
    ///
    /// # use std::path::Path;
    ///
    /// ```no_run
    /// use std::fs;
    ///
    /// fn main() -> std::io::Result<()> {
    ///     let metadata = fs::metadata("foo.txt")?;
    ///
    ///     assert!(metadata.is_file());
    ///     Ok(())
    /// }
    /// ```
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn is_file(&self) -> bool {
        self.file_type().is_file()
    }

    /// Returns `true` if this metadata is for a symbolic link.
    ///
    /// # use std::fs;
    ///
    #[cfg_attr(unix, doc = "```no_run")]
    #[cfg_attr(not(unix), doc = "```ignore")]
    /// use std::fs;
    /// let link_path = Path::new("link");
    /// symlink("/origin_does_not_exist/", link_path)?;
    ///
    /// fn main() -> std::io::Result<()> {
    /// assert!(metadata.is_symlink());
    /// use std::fs;
    ///
    ///     let metadata = fs::symlink_metadata(link_path)?;
    ///
    /// let metadata = fs::metadata("foo.txt")?;
    ///     Ok(())
    /// }
    /// ```
    #[must_use]
    #[stable(feature = "is_symlink", since = "1.58.0")]
    pub fn is_symlink(&self) -> bool {
        self.file_type().is_symlink()
    }

    /// Returns the size of the file, in bytes, this metadata is for.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use std::fs;
    ///
    /// fn main() -> std::io::Result<()> {
    /// let metadata = fs::metadata("foo.txt")?;
    ///
    /// assert_eq!(0, metadata.len());
    ///     Ok(())
    /// }
    /// ```
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn len(&self) -> u64 {
        self.0.size()
    }

    /// Returns the permissions of the file this metadata is for.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use std::fs;
    ///
    /// fn main() -> std::io::Result<()> {
    /// let metadata = fs::metadata("foo.txt")?;
    ///
    /// assert!(!metadata.permissions().readonly());
    ///     Ok(())
    /// }
    /// ```
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn permissions(&self) -> Permissions {
        Permissions(self.0.perm())
    }

    /// Returns the last modification time listed in this metadata.
    ///
    /// The returned value corresponds to the `mtime` field of `stat` on Unix
    /// platforms and the `ftLastWriteTime` field on Windows platforms.
    ///
    /// # Errors
    ///
    /// This field might not be available on all platforms, and will return an
    /// `Err` on platforms where it is not available.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use std::fs;
    ///
    /// fn main() -> std::io::Result<()> {
    /// let metadata = fs::metadata("foo.txt")?;
    ///
    /// if let Ok(time) = metadata.modified() {
    /// println!("{time:?}");
    /// } else {
    /// println!("此平台不支持");
    ///     }
    ///     Ok(())
    /// }
    /// ```
    #[doc(alias = "mtime", alias = "ftLastWriteTime")]
    #[stable(feature = "fs_time", since = "1.10.0")]
    pub fn modified(&self) -> io::Result<SystemTime> {
        self.0.modified().map(FromInner::from_inner)
    }

    /// Returns the last access time of this metadata.
    ///
    /// The returned value corresponds to the `atime` field of `stat` on Unix
    /// platforms and the `ftLastAccessTime` field on Windows platforms.
    ///
    /// Note that not all platforms will keep this field update in a file's
    /// metadata, for example Windows has an option to disable updating this
    /// time when files are accessed and Linux similarly has `noatime`.
    ///
    /// # Errors
    ///
    /// This field might not be available on all platforms, and will return an
    /// `Err` on platforms where it is not available.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use std::fs;
    ///
    /// fn main() -> std::io::Result<()> {
    /// let metadata = fs::metadata("foo.txt")?;
    ///
    /// if let Ok(time) = metadata.accessed() {
    /// println!("{time:?}");
    /// } else {
    /// println!("此平台不支持");
    ///     }
    ///     Ok(())
    /// }
    /// ```
    #[doc(alias = "atime", alias = "ftLastAccessTime")]
    #[stable(feature = "fs_time", since = "1.10.0")]
    pub fn accessed(&self) -> io::Result<SystemTime> {
        self.0.accessed().map(FromInner::from_inner)
    }

    /// Returns the creation time listed in this metadata.
    ///
    /// The returned value corresponds to the `btime` field of `statx` on
    /// Linux kernel starting from to 4.11, the `birthtime` field of `stat` on other
    /// Unix platforms, and the `ftCreationTime` field on Windows platforms.
    ///
    /// # Errors
    ///
    /// This field might not be available on all platforms, and will return an
    /// `Err` on platforms or filesystems where it is not available.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// 使用标准库中的 `fs` 模块；
    ///
    /// fn main() -> std::io::Result<()> {
    /// `let metadata = fs::metadata("foo.txt")?;`；
    ///
    /// 如果 `metadata.created()` 能成功获取，则：
    /// `println!("{time:?}");`；
    /// 否则：
    /// `println!("此平台或文件系统不支持");`；
    ///     }
    ///     Ok(())
    /// }
    /// ```
    #[doc(alias = "btime", alias = "birthtime", alias = "ftCreationTime")]
    #[stable(feature = "fs_time", since = "1.10.0")]
    pub fn created(&self) -> io::Result<SystemTime> {
        self.0.created().map(FromInner::from_inner)
    }
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl fmt::Debug for Metadata {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let mut debug = f.debug_struct("Metadata");
        debug.field("file_type", &self.file_type());
        debug.field("permissions", &self.permissions());
        debug.field("len", &self.len());
        if let Ok(modified) = self.modified() {
            debug.field("modified", &modified);
        }
        if let Ok(accessed) = self.accessed() {
            debug.field("accessed", &accessed);
        }
        if let Ok(created) = self.created() {
            debug.field("created", &created);
        }
        debug.finish_non_exhaustive()
    }
}

impl IntoInner<fs_imp::FileAttr> for Metadata {
    fn into_inner(self) -> fs_imp::FileAttr {
        self.0
    }
}

impl AsInner<fs_imp::FileAttr> for Metadata {
    #[inline]
    fn as_inner(&self) -> &fs_imp::FileAttr {
        &self.0
    }
}

impl FromInner<fs_imp::FileAttr> for Metadata {
    fn from_inner(attr: fs_imp::FileAttr) -> Metadata {
        Metadata(attr)
    }
}

impl FileTimes {
    /// Creates a new `FileTimes` with no times set.
    ///
    /// Using the resulting `FileTimes` in [`File::set_times`] will not modify any timestamps.
    #[stable(feature = "file_set_times", since = "1.75.0")]
    pub fn new() -> Self {
        Self::default()
    }

    /// Set the last access time of a file.
    #[stable(feature = "file_set_times", since = "1.75.0")]
    pub fn set_accessed(mut self, t: SystemTime) -> Self {
        self.0.set_accessed(t.into_inner());
        self
    }

    /// Set the last modified time of a file.
    #[stable(feature = "file_set_times", since = "1.75.0")]
    pub fn set_modified(mut self, t: SystemTime) -> Self {
        self.0.set_modified(t.into_inner());
        self
    }
}

impl AsInnerMut<fs_imp::FileTimes> for FileTimes {
    fn as_inner_mut(&mut self) -> &mut fs_imp::FileTimes {
        &mut self.0
    }
}

impl Permissions {
    /// Returns `true` if these permissions describe a readonly (unwritable) file.
    ///
    /// # Note
    ///
    /// This function does not take Access Control Lists (ACLs), Unix group
    /// membership and other nuances into account.
    /// Therefore the return value of this function cannot be relied upon
    /// to predict whether attempts to read or write the file will actually succeed.
    ///
    /// # Windows
    ///
    /// On Windows this returns [`FILE_ATTRIBUTE_READONLY`](https://docs.microsoft.com/en-us/windows/win32/fileio/file-attribute-constants).
    /// If `FILE_ATTRIBUTE_READONLY` is set then writes to the file will fail
    /// but the user may still have permission to change this flag. If
    /// `FILE_ATTRIBUTE_READONLY` is *not* set then writes may still fail due
    /// to lack of write permission.
    /// The behavior of this attribute for directories depends on the Windows
    /// version.
    ///
    /// # Unix (including macOS)
    ///
    /// On Unix-based platforms this checks if *any* of the owner, group or others
    /// write permission bits are set. It does not consider anything else, including:
    ///
    /// * Whether the current user is in the file's assigned group.
    /// * Permissions granted by ACL.
    /// * That `root` user can write to files that do not have any write bits set.
    /// * Writable files on a filesystem that is mounted read-only.
    ///
    /// The [`PermissionsExt`] trait gives direct access to the permission bits but
    /// also does not read ACLs.
    ///
    /// [`PermissionsExt`]: crate::os::unix::fs::PermissionsExt
    ///
    /// # Examples
    ///
    /// ```no_run
    /// 使用标准库中的 `fs::File` 模块；
    ///
    /// fn main() -> std::io::Result<()> {
    /// `let mut f = File::create("foo.txt")?;`；
    /// `let metadata = f.metadata()?;`；
    ///
    /// 断言 `metadata.permissions().readonly()` 为 `false`；
    ///     Ok(())
    /// }
    /// ```
    #[must_use = "call `set_readonly` to modify the readonly flag"]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn readonly(&self) -> bool {
        self.0.readonly()
    }

    /// Modifies the readonly flag for this set of permissions. If the
    /// `readonly` argument is `true`, using the resulting `Permission` will
    /// update file permissions to forbid writing. Conversely, if it's `false`,
    /// using the resulting `Permission` will update file permissions to allow
    /// writing.
    ///
    /// This operation does **not** modify the files attributes. This only
    /// changes the in-memory value of these attributes for this `Permissions`
    /// instance. To modify the files attributes use the [`set_permissions`]
    /// function which commits these attribute changes to the file.
    ///
    /// # Note
    ///
    /// `set_readonly(false)` makes the file *world-writable* on Unix.
    /// You can use the [`PermissionsExt`] trait on Unix to avoid this issue.
    ///
    /// It also does not take Access Control Lists (ACLs) or Unix group
    /// membership into account.
    ///
    /// # Windows
    ///
    /// On Windows this sets or clears [`FILE_ATTRIBUTE_READONLY`](https://docs.microsoft.com/en-us/windows/win32/fileio/file-attribute-constants).
    /// If `FILE_ATTRIBUTE_READONLY` is set then writes to the file will fail
    /// but the user may still have permission to change this flag. If
    /// `FILE_ATTRIBUTE_READONLY` is *not* set then the write may still fail if
    /// the user does not have permission to write to the file.
    ///
    /// In Windows 7 and earlier this attribute prevents deleting empty
    /// directories. It does not prevent modifying the directory contents.
    /// On later versions of Windows this attribute is ignored for directories.
    ///
    /// # Unix (including macOS)
    ///
    /// On Unix-based platforms this sets or clears the write access bit for
    /// the owner, group *and* others, equivalent to `chmod a+w <file>`
    /// or `chmod a-w <file>` respectively. The latter will grant write access
    /// to all users! You can use the [`PermissionsExt`] trait on Unix
    /// to avoid this issue.
    ///
    /// [`PermissionsExt`]: crate::os::unix::fs::PermissionsExt
    ///
    /// # Examples
    ///
    /// ```no_run
    /// 使用标准库中的 `fs::File` 模块；
    ///
    /// fn main() -> std::io::Result<()> {
    /// `let f = File::create("foo.txt")?;`；
    /// `let metadata = f.metadata()?;`；
    /// 创建一个切片 `mut permissions = metadata.permissions();`；
    ///
    /// `permissions.set_readonly(true);`；
    ///
    /// // 文件系统没有变化，仅内存中的状态有变化；
    /// // 只读权限；
    /// 断言 `metadata.permissions().readonly()` 为 `false`；
    ///
    ///     // just this particular `permissions`.
    /// 断言 `permissions.readonly()` 为 `true`；
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn set_readonly(&mut self, readonly: bool) {
        self.0.set_readonly(readonly)
    }
}

impl FileType {
    /// Tests whether this file type represents a directory. The
    /// result is mutually exclusive to the results of
    /// [`is_file`] and [`is_symlink`]; only zero or one of these
    /// tests may pass.
    ///
    /// [`is_file`]: FileType::is_file
    /// [`is_symlink`]: FileType::is_symlink
    ///
    /// # Examples
    ///
    /// ```no_run
    /// fn main() -> std::io::Result<()> {
    /// 使用标准库中的 `fs` 模块；
    ///
    /// `let metadata = fs::metadata("foo.txt")?;`；
    /// 获取文件类型 `let file_type = metadata.file_type();`；
    ///
    /// 断言 `file_type.is_dir()` 为 `false`；
    ///     Ok(())
    /// }
    /// ```
    #[must_use]
    #[stable(feature = "file_type", since = "1.1.0")]
    pub fn is_dir(&self) -> bool {
        self.0.is_dir()
    }

    /// Tests whether this file type represents a regular file.
    /// The result is mutually exclusive to the results of
    /// [`is_dir`] and [`is_symlink`]; only zero or one of these
    /// tests may pass.
    ///
    /// When the goal is simply to read from (or write to) the source, the most
    /// reliable way to test the source can be read (or written to) is to open
    /// it. Only using `is_file` can break workflows like `diff <( prog_a )` on
    /// a Unix-like system for example. See [`File::open`] or
    /// [`OpenOptions::open`] for more information.
    ///
    /// [`is_dir`]: FileType::is_dir
    /// [`is_symlink`]: FileType::is_symlink
    ///
    /// # Examples
    ///
    /// ```no_run
    /// fn main() -> std::io::Result<()> {
    /// 使用标准库中的 `fs` 模块；
    ///
    /// `let metadata = fs::metadata("foo.txt")?;`；
    /// 获取文件类型 `let file_type = metadata.file_type();`；
    ///
    /// 断言 `file_type.is_file()` 为 `true`；
    ///     Ok(())
    /// }
    /// ```
    #[must_use]
    #[stable(feature = "file_type", since = "1.1.0")]
    pub fn is_file(&self) -> bool {
        self.0.is_file()
    }

    /// Tests whether this file type represents a symbolic link.
    /// The result is mutually exclusive to the results of
    /// [`is_dir`] and [`is_file`]; only zero or one of these
    /// tests may pass.
    ///
    /// The underlying [`Metadata`] struct needs to be retrieved
    /// with the [`fs::symlink_metadata`] function and not the
    /// [`fs::metadata`] function. The [`fs::metadata`] function
    /// follows symbolic links, so [`is_symlink`] would always
    /// return `false` for the target file.
    ///
    /// [`fs::metadata`]: metadata
    /// [`fs::symlink_metadata`]: symlink_metadata
    /// [`is_dir`]: FileType::is_dir
    /// [`is_file`]: FileType::is_file
    /// [`is_symlink`]: FileType::is_symlink
    ///
    /// # Examples
    ///
    /// ```no_run
    /// 使用标准库中的 `fs` 模块；
    ///
    /// fn main() -> std::io::Result<()> {
    /// `let metadata = fs::symlink_metadata("foo.txt")?;`；
    /// 获取文件类型 `let file_type = metadata.file_type();`；
    ///
    /// 断言 `file_type.is_symlink()` 为 `false`；
    ///     Ok(())
    /// }
    /// ```
    #[must_use]
    #[stable(feature = "file_type", since = "1.1.0")]
    pub fn is_symlink(&self) -> bool {
        self.0.is_symlink()
    }
}

#[stable(feature = "std_debug", since = "1.16.0")]
impl fmt::Debug for FileType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("FileType")
            .field("is_file", &self.is_file())
            .field("is_dir", &self.is_dir())
            .field("is_symlink", &self.is_symlink())
            .finish_non_exhaustive()
    }
}

impl AsInner<fs_imp::FileType> for FileType {
    #[inline]
    fn as_inner(&self) -> &fs_imp::FileType {
        &self.0
    }
}

impl FromInner<fs_imp::FilePermissions> for Permissions {
    fn from_inner(f: fs_imp::FilePermissions) -> Permissions {
        Permissions(f)
    }
}

impl AsInner<fs_imp::FilePermissions> for Permissions {
    #[inline]
    fn as_inner(&self) -> &fs_imp::FilePermissions {
        &self.0
    }
}

impl ReadDir {
    /// Returns a handle for the directory this `ReadDir` is reading.
    ///
    /// Whenever possible, the new handle will be created in a race-free manner from the underlying
    /// handle used by `ReadDir`. However, this may fall back to opening a new handle based on the
    /// path, which is subject to race conditions if the file system has changed since the `ReadDir`
    /// was created.
    // FIXME: before stabilization, ensure that we have a race-free implementation on Windows!
    #[unstable(feature = "dirfd", issue = "120426")]
    pub fn dir(&self) -> io::Result<Dir> {
        self.0.dir().map(|d| Dir { inner: d })
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Iterator for ReadDir {
    type Item = io::Result<DirEntry>;

    fn next(&mut self) -> Option<io::Result<DirEntry>> {
        self.0.next().map(|entry| entry.map(DirEntry))
    }
}

impl DirEntry {
    /// Returns the full path to the file that this entry represents.
    ///
    /// The full path is created by joining the original path to `read_dir`
    /// with the filename of this entry.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// 使用标准库中的 `fs` 模块；
    ///
    /// fn main() -> std::io::Result<()> {
    /// `for entry in fs::read_dir(".")?;`；
    /// 遍历目录项 `let dir = entry?;`；
    /// `println!("{:?}", dir.path());`；
    ///     }
    ///     Ok(())
    /// }
    /// ```
    ///
    /// This prints output like:
    ///
    /// ```text
    /// “./whatever.txt”
    /// “./foo.html”
    /// “./hello_world.rs”
    /// ```
    ///
    /// The exact text, of course, depends on what files you have in `.`.
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn path(&self) -> PathBuf {
        self.0.path()
    }

    /// Returns the metadata for the file that this entry points at.
    ///
    /// This function will not traverse symlinks if this entry points at a
    /// symlink. To traverse symlinks use [`fs::metadata`] or [`fs::File::metadata`].
    ///
    /// [`fs::metadata`]: metadata
    /// [`fs::File::metadata`]: File::metadata
    ///
    /// # Platform-specific behavior
    ///
    /// On Windows this function is cheap to call (no extra system calls
    /// needed), but on Unix platforms this function is the equivalent of
    /// calling `symlink_metadata` on the path. In that case, if the file has been renamed or
    /// replaced since the `DirEntry` was created, this can fail or return the metadata of a
    /// different file!
    ///
    /// # Examples
    ///
    /// ```
    /// # if cfg!(all(windows, skip_unsupported_miri_tests)) { return; }
    /// 使用标准库中的 `fs` 模块；
    ///
    /// 如果 `fs::read_dir(".")` 能成功获取，则：
    /// `for entry in entries;`；
    /// 如果 `entry` 能成功获取，则：
    ///             // Here, `entry` is a `DirEntry`.
    /// 如果 `entry.metadata()` 能成功获取，则：
    /// // 现在让我们查看该项的权限！
    /// `println!("{:?}: {:?}", entry.path(), metadata.permissions());`；
    /// 否则：
    /// `println!("无法获取 {:?} 的元数据"; entry.path());`；
    ///             }
    ///         }
    ///     }
    /// }
    /// ```
    #[stable(feature = "dir_entry_ext", since = "1.1.0")]
    pub fn metadata(&self) -> io::Result<Metadata> {
        self.0.metadata().map(Metadata)
    }

    /// Returns the file type for the file that this entry points at.
    ///
    /// This function will not traverse symlinks if this entry points at a
    /// symlink.
    ///
    /// # Platform-specific behavior
    ///
    /// On Windows and most Unix platforms and file systems this function is free (no extra
    /// system calls needed), but some Unix platforms or file systems may require the equivalent of
    /// calling `symlink_metadata` to learn about the target file type. In that case, if the file
    /// has been renamed or replaced since the `DirEntry` was created, this can fail or return the
    /// file type of a different file!
    ///
    /// # Examples
    ///
    /// ```
    /// # if cfg!(all(windows, skip_unsupported_miri_tests)) { return; }
    /// 使用标准库中的 `fs` 模块；
    ///
    /// 如果 `fs::read_dir(".")` 能成功获取，则：
    /// 对于 entries 中的每一项：
    /// 如果可以获取 entry：
    ///             // Here, `entry` is a `DirEntry`.
    /// 如果可以获取 entry.file_type()：
    /// 现在让我们展示该项的文件类型！
    /// 打印：“{:?}: {:?}”，其中 entry.path() 是文件路径，file_type 是文件类型。
    /// } 否则：
    /// 打印：“无法获取 {:?} 的文件类型”。
    ///             }
    ///         }
    ///     }
    /// }
    /// ```
    #[stable(feature = "dir_entry_ext", since = "1.1.0")]
    pub fn file_type(&self) -> io::Result<FileType> {
        self.0.file_type().map(FileType)
    }

    /// Returns the file name of this directory entry without any
    /// leading path component(s).
    ///
    /// As an example,
    /// the output of the function will result in "foo" for all the following paths:
    /// - "./foo"
    /// - "/the/foo"
    /// - "../../foo"
    ///
    /// # Examples
    ///
    /// ```
    /// # if cfg!(all(windows, skip_unsupported_miri_tests)) { return; }
    /// use std::fs;
    ///
    /// 如果可以获取 fs::read_dir(".") 的结果：
    /// 对于 entries 中的每一项：
    /// 如果可以获取 entry：
    ///             // Here, `entry` is a `DirEntry`.
    /// 打印：“{:?}”，其中 entry.file_name() 是文件名称。
    ///         }
    ///     }
    /// }
    /// ```
    #[must_use]
    #[stable(feature = "dir_entry_ext", since = "1.1.0")]
    pub fn file_name(&self) -> OsString {
        self.0.file_name()
    }
}

#[stable(feature = "dir_entry_debug", since = "1.13.0")]
impl fmt::Debug for DirEntry {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_tuple("DirEntry").field(&self.path()).finish()
    }
}

impl AsInner<fs_imp::DirEntry> for DirEntry {
    #[inline]
    fn as_inner(&self) -> &fs_imp::DirEntry {
        &self.0
    }
}

/// Removes a file from the filesystem.
///
/// Note that there is no
/// guarantee that the file is immediately deleted (e.g., depending on
/// platform, other open file descriptors may prevent immediate removal).
///
/// # Platform-specific behavior
///
/// This function currently corresponds to the `unlink` function on Unix.
/// On Windows, `DeleteFile` is used or `CreateFileW` and `SetInformationByHandle` for readonly files.
/// Note that, this [may change in the future][changes].
///
/// On Windows, symbolic links to directories cannot currently be removed with this function.
/// Use [`remove_dir`] for that purpose.
///
/// [changes]: io#platform-specific-behavior
///
/// # Errors
///
/// This function will return an error in the following situations, but is not
/// limited to just these cases:
///
/// * `path` points to a directory.
/// * The file doesn't exist.
/// * The user lacks permissions to remove the file.
///
/// This function will only ever return an error of kind `NotFound` if the given
/// path does not exist. Note that the inverse is not true,
/// i.e. if a path does not exist, its removal may fail for a number of reasons,
/// such as insufficient permissions.
///
/// # Examples
///
/// ```no_run
/// use std::fs;
///
/// fn main() -> std::io::Result<()> {
/// fs::remove_file("a.txt")?;
///     Ok(())
/// }
/// ```
#[doc(alias = "rm", alias = "unlink", alias = "DeleteFile")]
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "fs_remove_file")]
pub fn remove_file<P: AsRef<Path>>(path: P) -> io::Result<()> {
    fs_imp::remove_file(path.as_ref())
}

/// Given a path, queries the file system to get information about a file,
/// directory, etc.
///
/// This function will traverse symbolic links to query information about the
/// destination file. To query metadata about the path itself without following
/// symbolic links, use [`symlink_metadata`].
///
/// # Platform-specific behavior
///
/// This function currently corresponds to the `stat` function on Unix
/// and the `GetFileInformationByHandle` function on Windows.
/// Note that, this [may change in the future][changes].
///
/// [changes]: io#platform-specific-behavior
///
/// # Errors
///
/// This function will return an error in the following situations, but is not
/// limited to just these cases:
///
/// * The user lacks permissions to perform `metadata` call on `path`.
/// * `path` does not exist.
/// * `path` is a symbolic link, but the destination file cannot be resolved.
///
/// # Examples
///
/// ```rust,no_run
/// use std::fs;
///
/// fn main() -> std::io::Result<()> {
/// let attr = fs::metadata("/some/file/path.txt")?;
/// // 检查 attr ...
///     Ok(())
/// }
/// ```
#[doc(alias = "stat", alias = "GetFileAttributes", alias = "GetFileAttributesEx")]
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "fs_metadata")]
pub fn metadata<P: AsRef<Path>>(path: P) -> io::Result<Metadata> {
    fs_imp::metadata(path.as_ref()).map(Metadata)
}

/// Queries the metadata about a file without following symlinks.
///
/// This function will return the [`Metadata`] of the exact path without
/// traversing symbolic links to a resolved destination file. Using this function
/// on a path that is a file or directory (not a symbolic link) will behave the
/// same as [`metadata`].
///
/// # Platform-specific behavior
///
/// This function currently corresponds to the `lstat` function on Unix
/// and the `GetFileInformationByHandle` function on Windows.
/// Note that, this [may change in the future][changes].
///
/// [changes]: io#platform-specific-behavior
///
/// # Errors
///
/// This function will return an error in the following situations, but is not
/// limited to just these cases:
///
/// * The user lacks permissions to perform `metadata` call on `path`.
/// * `path` does not exist.
///
/// # Examples
///
/// ```rust,no_run
/// use std::fs;
///
/// fn main() -> std::io::Result<()> {
/// let attr = fs::symlink_metadata("/some/file/path.txt")?;
/// // 检查 attr ...
///     Ok(())
/// }
/// ```
#[doc(alias = "lstat", alias = "GetFileAttributes", alias = "GetFileAttributesEx")]
#[stable(feature = "symlink_metadata", since = "1.1.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "fs_symlink_metadata")]
pub fn symlink_metadata<P: AsRef<Path>>(path: P) -> io::Result<Metadata> {
    fs_imp::symlink_metadata(path.as_ref()).map(Metadata)
}

/// Renames a file or directory to a new name, replacing the original file if
/// `to` already exists.
///
/// This will not work if the new name is on a different mount point.
///
/// # Platform-specific behavior
///
/// This function currently corresponds to the [rename] function on Unix, and
/// `MoveFileExW` with a fallback to `SetFileInformationByHandle` on Windows.
/// The exact behavior differs:
///
/// - If `to` does not exist, `from` can be anything.
/// - On Unix, when `from` is a directory and `to` exists, `to` must be an empty directory.
/// - On Unix, when `from` is not a directory and `to` exists, `to` may not be a directory.
/// - On Windows 10 version 1607 and above, the behavior is the same as Unix if the
///   filesystem supports  `FileRenameInfoEx`.
/// - Otherwise on Windows, `from` can be anything but `to` must not be a directory.
///
/// Note that, this [may change in the future][changes].
///
/// [changes]: io#platform-specific-behavior
/// [rename]: https://pubs.opengroup.org/onlinepubs/9799919799/functions/rename.html
///
/// # Errors
///
/// This function will return an error in the following situations, but is not
/// limited to just these cases:
///
/// * `from` does not exist.
/// * The user lacks permissions to view contents.
/// * `from` and `to` are on separate filesystems.
///
/// # Examples
///
/// ```no_run
/// use std::fs;
///
/// fn main() -> std::io::Result<()> {
/// fs::rename("a.txt", "b.txt")?; // 将 a.txt 重命名为 b.txt
///     Ok(())
/// }
/// ```
#[doc(alias = "mv", alias = "MoveFile", alias = "MoveFileEx")]
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "fs_rename")]
pub fn rename<P: AsRef<Path>, Q: AsRef<Path>>(from: P, to: Q) -> io::Result<()> {
    fs_imp::rename(from.as_ref(), to.as_ref())
}

/// Renames a file or directory to a new name, returning [`AlreadyExists`] if `to` already
/// exists.
///
/// Unlike [`fs::rename`], the destination is never overwritten. The check happens as part of the
/// same operation, which avoids check-then-rename races.
///
/// If the system crashes in the middle, it may be possible to end up with both copies of the file
/// existing, but it should not be possible to end up with zero copies, or with a half-written file.
///
/// This will not work if the new name is on a different mount point.
///
/// # Platform-specific behavior
///
/// This function currently corresponds to:
///
/// * [renameat2] with `RENAME_NOREPLACE` on Linux and Android
/// * `renamex_np` with `RENAME_EXCL` on Apple platforms
/// * [MoveFileExW] without the `MOVEFILE_REPLACE_EXISTING` flag, with a fallback to
///   `SetFileInformationByHandle`, on Windows
/// * `link` followed by `unlink` on other Unix platforms and on WASI
/// * Otherwise, this function returns [`Unsupported`]
///
/// The `link` and `unlink` fallback is also used at runtime on Linux, Android and Apple platforms
/// when the kernel or the filesystem does not support the flag, so which of these applies can
/// differ between filesystems on the same machine.
///
/// Note that, this [may change in the future][changes].
///
/// [changes]: io#platform-specific-behavior
/// [renameat2]: https://man7.org/linux/man-pages/man2/renameat2.2.html
/// [MoveFileExW]: https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw
/// [`AlreadyExists`]: crate::io::ErrorKind::AlreadyExists
/// [`Unsupported`]: crate::io::ErrorKind::Unsupported
/// [`fs::rename`]: crate::fs::rename
///
/// # Errors
///
/// This function will return an error in the following situations, but is not
/// limited to just these cases:
///
/// * `from` does not exist.
/// * The user lacks permissions to view contents.
/// * `from` and `to` are on separate filesystems.
/// * `to` already exists.
/// * The platform does not support this operation.
///
/// # Examples
///
/// ```no_run
/// #![feature(rename_noreplace)]
/// use std::fs;
/// use std::io::ErrorKind;
///
/// fn main() -> std::io::Result<()> {
/// // 将 a.txt 重命名为 b.txt，但 b.txt 尚未存在。
/// fs::rename_noreplace("a.txt", "b.txt")?;
///
/// // 现在 b.txt 已存在，因此此操作会失败而不是静默覆盖它。
/// let err = fs::rename_noreplace("c.txt", "b.txt").unwrap_err();
/// assert_eq!(err.kind(), ErrorKind::AlreadyExists);
///     Ok(())
/// }
/// ```
#[doc(alias = "renameat2", alias = "renamex_np", alias = "MoveFileEx", alias = "RENAME_NOREPLACE")]
#[unstable(feature = "rename_noreplace", issue = "161427")]
#[cfg_attr(not(test), rustc_diagnostic_item = "fs_rename_noreplace")]
pub fn rename_noreplace<P: AsRef<Path>, Q: AsRef<Path>>(from: P, to: Q) -> io::Result<()> {
    fs_imp::rename_noreplace(from.as_ref(), to.as_ref())
}

/// Copies the contents of one file to another. This function will also
/// copy the permission bits of the original file to the destination file.
///
/// This function will **overwrite** the contents of `to`.
///
/// Note that if `from` and `to` both point to the same file, then the file
/// will likely get truncated by this operation.
///
/// On success, the total number of bytes copied is returned and it is equal to
/// the length of the `to` file as reported by `metadata`.
///
/// If you want to copy the contents of one file to another and you’re
/// working with [`File`]s, see the [`io::copy`](io::copy()) function.
///
/// # Platform-specific behavior
///
/// This function currently corresponds to the `open` function in Unix
/// with `O_RDONLY` for `from` and `O_WRONLY`, `O_CREAT`, and `O_TRUNC` for `to`.
/// `O_CLOEXEC` is set for returned file descriptors.
///
/// On Linux (including Android), this function uses copy_file_range(2),
/// sendfile(2), or splice(2) syscalls to move data directly between files
/// if possible.
///
/// On Windows, this function currently corresponds to `CopyFileEx`. Alternate
/// NTFS streams are copied but only the size of the main stream is returned by
/// this function.
///
/// On MacOS, this function corresponds to `fclonefileat` and `fcopyfile`.
///
/// Note that platform-specific behavior [may change in the future][changes].
///
/// [changes]: io#platform-specific-behavior
///
/// # Errors
///
/// This function will return an error in the following situations, but is not
/// limited to just these cases:
///
/// * `from` is neither a regular file nor a symlink to a regular file.
/// * `from` does not exist.
/// * The current process does not have the permission rights to read
///   `from` or write `to`.
/// * The parent directory of `to` doesn't exist.
///
/// # Examples
///
/// ```no_run
/// use std::fs;
///
/// fn main() -> std::io::Result<()> {
/// fs::copy("foo.txt", "bar.txt")?;  // 将 foo.txt 复制到 bar.txt
///     Ok(())
/// }
/// ```
#[doc(alias = "cp")]
#[doc(alias = "copy_file_range")]
#[doc(alias = "CopyFile", alias = "CopyFileEx")]
#[doc(alias = "fclonefileat", alias = "fcopyfile")]
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "fs_copy")]
pub fn copy<P: AsRef<Path>, Q: AsRef<Path>>(from: P, to: Q) -> io::Result<u64> {
    fs_imp::copy(from.as_ref(), to.as_ref())
}

/// Creates a new hard link on the filesystem.
///
/// The `link` path will be a link pointing to the `original` path. Note that
/// systems often require these two paths to both be located on the same
/// filesystem.
///
/// If `original` names a symbolic link, it is platform-specific whether the
/// symbolic link is followed. On platforms where it's possible to not follow
/// it, it is not followed, and the created hard link points to the symbolic
/// link itself.
///
/// # Platform-specific behavior
///
/// This function currently corresponds to the `CreateHardLink` function on Windows.
/// On most Unix systems, it corresponds to the `linkat` function with no flags.
/// On VxWorks and Redox, it instead corresponds to the `link` function.
/// On MacOS, it uses the `linkat` function if it is available, but on very old
/// systems where `linkat` is not available, `link` is selected at runtime instead.
/// Note that, this [may change in the future][changes].
///
/// [changes]: io#platform-specific-behavior
///
/// # Errors
///
/// This function will return an error in the following situations, but is not
/// limited to just these cases:
///
/// * The `original` path is not a file or doesn't exist.
/// * The 'link' path already exists.
///
/// # Examples
///
/// ```no_run
/// use std::fs;
///
/// fn main() -> std::io::Result<()> {
/// fs::hard_link("a.txt", "b.txt")?; // 将 a.txt 硬链接到 b.txt
///     Ok(())
/// }
/// ```
#[doc(alias = "CreateHardLink", alias = "linkat")]
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "fs_hard_link")]
pub fn hard_link<P: AsRef<Path>, Q: AsRef<Path>>(original: P, link: Q) -> io::Result<()> {
    fs_imp::hard_link(original.as_ref(), link.as_ref())
}

/// Creates a new symbolic link on the filesystem.
///
/// The `link` path will be a symbolic link pointing to the `original` path.
/// On Windows, this will be a file symlink, not a directory symlink;
/// for this reason, the platform-specific [`std::os::unix::fs::symlink`]
/// and [`std::os::windows::fs::symlink_file`] or [`symlink_dir`] should be
/// used instead to make the intent explicit.
///
/// [`std::os::unix::fs::symlink`]: crate::os::unix::fs::symlink
/// [`std::os::windows::fs::symlink_file`]: crate::os::windows::fs::symlink_file
/// [`symlink_dir`]: crate::os::windows::fs::symlink_dir
///
/// # Examples
///
/// ```no_run
/// use std::fs;
///
/// fn main() -> std::io::Result<()> {
/// fs::soft_link("a.txt", "b.txt")?;
///     Ok(())
/// }
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[deprecated(
    since = "1.1.0",
    note = "replaced with std::os::unix::fs::symlink and \
            std::os::windows::fs::{symlink_file, symlink_dir}"
)]
pub fn soft_link<P: AsRef<Path>, Q: AsRef<Path>>(original: P, link: Q) -> io::Result<()> {
    fs_imp::symlink(original.as_ref(), link.as_ref())
}

/// Reads a symbolic link, returning the file that the link points to.
///
/// # Platform-specific behavior
///
/// This function currently corresponds to the `readlink` function on Unix
/// and the `CreateFile` function with `FILE_FLAG_OPEN_REPARSE_POINT` and
/// `FILE_FLAG_BACKUP_SEMANTICS` flags on Windows.
/// Note that, this [may change in the future][changes].
///
/// [changes]: io#platform-specific-behavior
///
/// # Errors
///
/// This function will return an error in the following situations, but is not
/// limited to just these cases:
///
/// * `path` is not a symbolic link.
/// * `path` does not exist.
///
/// # Examples
///
/// ```no_run
/// use std::fs;
///
/// fn main() -> std::io::Result<()> {
/// let path = fs::read_link("a.txt")?;
///     Ok(())
/// }
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "fs_read_link")]
pub fn read_link<P: AsRef<Path>>(path: P) -> io::Result<PathBuf> {
    fs_imp::read_link(path.as_ref())
}

/// Returns the canonical, absolute form of a path with all intermediate
/// components normalized and symbolic links resolved.
///
/// # Platform-specific behavior
///
/// This function currently corresponds to the `realpath` function on Unix
/// and the `CreateFile` and `GetFinalPathNameByHandle` functions on Windows.
/// Note that this [may change in the future][changes].
///
/// On Windows, this converts the path to use [extended length path][path]
/// syntax, which allows your program to use longer path names, but means you
/// can only join backslash-delimited paths to it, and it may be incompatible
/// with other applications (if passed to the application on the command-line,
/// or written to a file another application may read).
///
/// [changes]: io#platform-specific-behavior
/// [path]: https://docs.microsoft.com/en-us/windows/win32/fileio/naming-a-file
///
/// # Errors
///
/// This function will return an error in the following situations, but is not
/// limited to just these cases:
///
/// * `path` does not exist.
/// * A non-final component in path is not a directory.
///
/// # Examples
///
/// ```no_run
/// use std::fs;
///
/// fn main() -> std::io::Result<()> {
/// let path = fs::canonicalize("../a/../foo.txt")?;
///     Ok(())
/// }
/// ```
#[doc(alias = "realpath")]
#[doc(alias = "GetFinalPathNameByHandle")]
#[stable(feature = "fs_canonicalize", since = "1.5.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "fs_canonicalize")]
pub fn canonicalize<P: AsRef<Path>>(path: P) -> io::Result<PathBuf> {
    fs_imp::canonicalize(path.as_ref())
}

/// Creates a new, empty directory at the provided path.
///
/// # Platform-specific behavior
///
/// This function currently corresponds to the `mkdir` function on Unix
/// and the `CreateDirectoryW` function on Windows.
/// Note that, this [may change in the future][changes].
///
/// [changes]: io#platform-specific-behavior
///
/// **NOTE**: If a parent of the given path doesn't exist, this function will
/// return an error. To create a directory and all its missing parents at the
/// same time, use the [`create_dir_all`] function.
///
/// # Errors
///
/// This function will return an error in the following situations, but is not
/// limited to just these cases:
///
/// * User lacks permissions to create directory at `path`.
/// * A parent of the given path doesn't exist. (To create a directory and all
///   its missing parents at the same time, use the [`create_dir_all`]
///   function.)
/// * `path` already exists.
///
/// # Examples
///
/// ```no_run
/// use std::fs;
///
/// fn main() -> std::io::Result<()> {
/// fs::create_dir("/some/dir")?;
///     Ok(())
/// }
/// ```
#[doc(alias = "mkdir", alias = "CreateDirectory")]
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "fs_create_dir")]
pub fn create_dir<P: AsRef<Path>>(path: P) -> io::Result<()> {
    DirBuilder::new().create(path.as_ref())
}

/// Recursively create a directory and all of its parent components if they
/// are missing.
///
/// This function is not atomic. If it returns an error, any parent components it was able to create
/// will remain.
///
/// If the empty path is passed to this function, it always succeeds without
/// creating any directories.
///
/// # Platform-specific behavior
///
/// This function currently corresponds to multiple calls to the `mkdir`
/// function on Unix and the `CreateDirectoryW` function on Windows.
///
/// Note that, this [may change in the future][changes].
///
/// [changes]: io#platform-specific-behavior
///
/// # Errors
///
/// The function will return an error if any directory specified in path does not exist and
/// could not be created. There may be other error conditions; see [`fs::create_dir`] for specifics.
///
/// Notable exception is made for situations where any of the directories
/// specified in the `path` could not be created as it was being created concurrently.
/// Such cases are considered to be successful. That is, calling `create_dir_all`
/// concurrently from multiple threads or processes is guaranteed not to fail
/// due to a race condition with itself.
///
/// [`fs::create_dir`]: create_dir
///
/// # Examples
///
/// ```no_run
/// use std::fs;
///
/// fn main() -> std::io::Result<()> {
/// fs::create_dir_all("/some/dir")?;
///     Ok(())
/// }
/// ```
#[doc(alias = "mkdir", alias = "CreateDirectory")]
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "fs_create_dir_all")]
pub fn create_dir_all<P: AsRef<Path>>(path: P) -> io::Result<()> {
    DirBuilder::new().recursive(true).create(path.as_ref())
}

/// Removes an empty directory.
///
/// If you want to remove a directory that is not empty, as well as all
/// of its contents recursively, consider using [`remove_dir_all`]
/// instead.
///
/// # Platform-specific behavior
///
/// This function currently corresponds to the `rmdir` function on Unix
/// and the `RemoveDirectory` function on Windows.
/// Note that, this [may change in the future][changes].
///
/// On Windows, this can also be used to remove symbolic links to directories.
/// On Unix, [`remove_file`] must be used for that purpose.
///
/// [changes]: io#platform-specific-behavior
///
/// # Errors
///
/// This function will return an error in the following situations, but is not
/// limited to just these cases:
///
/// * `path` doesn't exist.
/// * `path` isn't a directory.
/// * The user lacks permissions to remove the directory at the provided `path`.
/// * The directory isn't empty.
///
/// This function will only ever return an error of kind `NotFound` if the given
/// path does not exist. Note that the inverse is not true,
/// i.e. if a path does not exist, its removal may fail for a number of reasons,
/// such as insufficient permissions.
///
/// # Examples
///
/// ```no_run
/// use std::fs;
///
/// fn main() -> std::io::Result<()> {
/// fs::remove_dir("/some/dir")?;
///     Ok(())
/// }
/// ```
#[doc(alias = "rmdir", alias = "RemoveDirectory")]
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "fs_remove_dir")]
pub fn remove_dir<P: AsRef<Path>>(path: P) -> io::Result<()> {
    fs_imp::remove_dir(path.as_ref())
}

/// Removes a directory at this path, after removing all its contents. Use
/// carefully!
///
/// This function does **not** follow symbolic links and it will simply remove the
/// symbolic link itself. If `path` itself is a symbolic link to a directory, it will get
/// removed. If it is a symbolic link to a file, behavior is platform-specific:
/// currently, it will get removed on Unix-like systems but not on Windows.
///
/// # Platform-specific behavior
///
/// These implementation details [may change in the future][changes].
///
/// - "Unix-like": By default, this function currently corresponds to
/// `openat`, `fdopendir`, `unlinkat` and `lstat`
/// on Unix-family platforms, except where noted otherwise.
/// - "Windows": This function currently corresponds to `CreateFileW`,
/// `GetFileInformationByHandleEx`, `SetFileInformationByHandle`, and `NtCreateFile`.
///
/// ## Time-of-check to time-of-use (TOCTOU) race conditions
/// See the [module-level TOCTOU explanation](self#time-of-check-to-time-of-use-toctou).
///
/// On most platforms, `fs::remove_dir_all` protects against symlink TOCTOU races by default.
/// However, on the following platforms, this protection is not provided and the function should
/// not be used in security-sensitive contexts:
/// - **Miri**: Even when emulating targets where the underlying implementation will protect against
///   TOCTOU races, Miri will not do so.
/// - **ESP-IDF**, **Horizon**, **PS Vita**, **QNX**, **Redox OS**, **VxWorks**: This function does
///   not protect against TOCTOU races, as the underlying platform does not implement the required
///   platform support to do so.
///
/// [TOCTOU]: self#time-of-check-to-time-of-use-toctou
/// [changes]: io#platform-specific-behavior
///
/// # Errors
///
/// See [`fs::remove_file`] and [`fs::remove_dir`].
///
/// [`remove_dir_all`] will fail if [`remove_dir`] or [`remove_file`] fail on *any* constituent
/// paths, *including* the root `path`. Consequently,
///
/// - The directory you are deleting *must* exist, meaning that this function is *not idempotent*.
/// - [`remove_dir_all`] will fail if the `path` is *not* a directory.
///
/// Consider ignoring the error if validating the removal is not required for your use case.
///
/// This function may return [`io::ErrorKind::DirectoryNotEmpty`] if the directory is concurrently
/// written into, which typically indicates some contents were removed but not all.
/// [`io::ErrorKind::NotFound`] is only returned if no removal occurs.
///
/// [`fs::remove_file`]: remove_file
/// [`fs::remove_dir`]: remove_dir
///
/// # Examples
///
/// ```no_run
/// 使用 std::fs;
///
/// fn main() -> std::io::Result<()> {
/// fs::remove_dir_all("/some/dir")?;
///     Ok(())
/// }
/// ```
#[doc(alias = "rm")]
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "fs_remove_dir_all")]
pub fn remove_dir_all<P: AsRef<Path>>(path: P) -> io::Result<()> {
    fs_imp::remove_dir_all(path.as_ref())
}

/// Returns an iterator over the entries within a directory.
///
/// The iterator will yield instances of <code>[io::Result]<[DirEntry]></code>.
/// New errors may be encountered after an iterator is initially constructed.
/// Entries for the current and parent directories (typically `.` and `..`) are
/// skipped.
///
/// The order in which `read_dir` returns entries can change between calls. If reproducible
/// ordering is required, the entries should be explicitly sorted.
///
/// # Platform-specific behavior
///
/// This function currently corresponds to the `opendir` function on Unix
/// and the `FindFirstFileEx` function on Windows. Advancing the iterator
/// currently corresponds to `readdir` on Unix and `FindNextFile` on Windows.
/// Note that, this [may change in the future][changes].
///
/// [changes]: io#platform-specific-behavior
///
/// The order in which this iterator returns entries is platform and filesystem
/// dependent.
///
/// # Errors
///
/// This function will return an error in the following situations, but is not
/// limited to just these cases:
///
/// * The provided `path` doesn't exist.
/// * The process lacks permissions to view the contents.
/// * The `path` points at a non-directory file.
///
/// # Examples
///
/// ```
/// 使用 std::io;
/// 使用 std::fs::{self, DirEntry};
/// 使用 std::path::Path;
///
/// // 一种仅访问文件的目录遍历实现方法
/// fn visit_dirs(dir: &Path, cb: &dyn Fn(&DirEntry)) -> io::Result<()> {
/// 如果 dir.is_dir() {
/// 对于 fs::read_dir(dir)? 中的条目进行遍历
/// 获取 entry？;
/// let path = entry.path();
/// 如果 path.is_dir() {
/// 对 path 调用 visit_dirs(&path, cb)?;
/// } 否则
/// 调用 cb(&entry);
///             }
///         }
///     }
///     Ok(())
/// }
/// ```
///
/// ```rust,no_run
/// 使用 std::io;
///
/// fn main() -> io::Result<()> {
/// 获取 fs::read_dir(".")? 的结果中的所有条目
/// 并将它们映射为 map(|e| e.path()) 的结果
///         .collect::<Result<Vec<_>, io::Error>>()?;
///
///     // The order in which `read_dir` returns entries is not guaranteed. If reproducible
/// // 需要排序时，应该显式对条目进行排序。
///
/// 对 entries 进行排序；
///
/// // 现在条目已经按路径排序了。
///
///     Ok(())
/// }
/// ```
#[doc(alias = "ls", alias = "opendir", alias = "FindFirstFile", alias = "FindNextFile")]
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "fs_read_dir")]
pub fn read_dir<P: AsRef<Path>>(path: P) -> io::Result<ReadDir> {
    fs_imp::read_dir(path.as_ref()).map(ReadDir)
}

/// Changes the permissions found on a file or a directory.
///
/// # Platform-specific behavior
///
/// This function currently corresponds to the `chmod` function on Unix
/// and the `SetFileAttributes` function on Windows.
/// Note that, this [may change in the future][changes].
///
/// [changes]: io#platform-specific-behavior
///
/// ## Symlinks
/// On UNIX-like systems, this function will update the permission bits
/// of the file pointed to by the symlink.
///
/// Note that this behavior can lead to privilege escalation vulnerabilities,
/// where the ability to create a symlink in one directory allows you to
/// cause the permissions of another file or directory to be modified.
///
/// For this reason, using this function with symlinks should be avoided.
/// When possible, permissions should be set at creation time instead.
///
/// # Rationale
/// POSIX does not specify an `lchmod` function,
/// and symlinks can be followed regardless of what permission bits are set.
///
/// # Errors
///
/// This function will return an error in the following situations, but is not
/// limited to just these cases:
///
/// * `path` does not exist.
/// * The user lacks the permission to change attributes of the file.
///
/// # Examples
///
/// ```no_run
/// 使用 std::fs;
///
/// fn main() -> std::io::Result<()> {
/// 获取 fs::metadata("foo.txt")?.permissions(); 的结果中的权限
/// 将 perms.set_readonly(true);
/// fs::set_permissions("foo.txt", perms)?;
///     Ok(())
/// }
/// ```
#[doc(alias = "chmod", alias = "SetFileAttributes")]
#[stable(feature = "set_permissions", since = "1.1.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "fs_set_permissions")]
pub fn set_permissions<P: AsRef<Path>>(path: P, perm: Permissions) -> io::Result<()> {
    fs_imp::set_permissions(path.as_ref(), perm.0)
}

/// Changes the permissions found on a file or a directory. On certain platforms, if the file
/// is a symlink, it will change the permissions bits on the symlink itself rather than
/// the target (e.g. Windows, BSD, MacOS). On other platforms, this results in an error when
/// attempting to change permissions on a symlink (e.g. Linux).
///
/// Note that non-final path elements are allowed to be symlinks.
///
/// # Platform-specific behavior
///
/// This function currently corresponds to the following underlying operations:
/// * Android: returns [`Unsupported`] on all files.
/// * Linux, BSD-based platforms, QNX, NTO: `fchmodat` with `AT_SYMLINK_NOFOLLOW`.
///   If that is not supported, we fall back to:
///   * Unix-based platforms with symlinks: `open` with `O_NOFOLLOW` followed by
///   [`fs::set_permissions`].
///   * Unix-based platforms without symlinks: `open` followed by [`fs::set_permissions`].
/// * Windows: `CreateFileW` with `FILE_FLAG_OPEN_REPARSE_POINT` followed
///   by `SetFileInformationByHandle`.
///
/// Note that, this [may change in the future][changes].
///
/// [changes]: io#platform-specific-behavior
///
/// [`fs::set_permissions`]: crate::fs::set_permissions
///
/// # Errors
///
/// This function will return an error in the following situations, but is not
/// limited to just these cases:
///
/// * `path` does not exist.
/// * The user lacks the permission to change attributes of the file.
///
/// Note: On Linux and other Unix-based platforms with symlinks (non-BSD-based),
/// this will result in an [`Unsupported`] error if the final element is a symlink.
///
/// [`Unsupported`]: crate::io::ErrorKind::Unsupported
///
/// # Examples
///
/// ```no_run
/// #![feature(set_permissions_nofollow)]
/// 使用 std::fs;
///
/// fn main() -> std::io::Result<()> {
/// 获取 fs::symlink_metadata("foo.txt")?.permissions(); 的结果中的权限
/// 将 perms.set_readonly(true);
/// // 在某些平台上这应该会导致错误，或者
/// // 能够成功修改符号链接的权限
/// fs::set_permissions_nofollow("foo.txt", perms)?;
///     Ok(())
/// }
/// ```
#[doc(alias = "fchmodat", alias = "SetFileInformationByHandle")]
#[unstable(feature = "set_permissions_nofollow", issue = "141607")]
#[cfg_attr(not(test), rustc_diagnostic_item = "fs_set_permissions_nofollow")]
pub fn set_permissions_nofollow<P: AsRef<Path>>(path: P, perm: Permissions) -> io::Result<()> {
    fs_imp::set_permissions_nofollow(path.as_ref(), perm.0)
}

impl DirBuilder {
    /// Creates a new set of options with default mode/security settings for all
    /// platforms and also non-recursive.
    ///
    /// # Examples
    ///
    /// ```
    /// 使用 std::fs::DirBuilder;
    ///
    /// 创建 DirBuilder 实例
    /// ```
    #[stable(feature = "dir_builder", since = "1.6.0")]
    #[must_use]
    pub fn new() -> DirBuilder {
        DirBuilder { inner: fs_imp::DirBuilder::new(), recursive: false }
    }

    /// Indicates that directories should be created recursively, creating all
    /// parent directories. Parents that do not exist are created with the same
    /// security and permissions settings.
    ///
    /// This option defaults to `false`.
    ///
    /// # Examples
    ///
    /// ```
    /// 使用 std::fs::DirBuilder;
    ///
    /// 创建 DirBuilder 实例
    /// 设置 builder.recursive(true);
    /// ```
    #[stable(feature = "dir_builder", since = "1.6.0")]
    pub fn recursive(&mut self, recursive: bool) -> &mut Self {
        self.recursive = recursive;
        self
    }

    /// Creates the specified directory with the options configured in this
    /// builder.
    ///
    /// It is considered an error if the directory already exists unless
    /// recursive mode is enabled.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// 使用 std::fs::{self, DirBuilder};
    ///
    /// 定义路径 /tmp/foo/bar/baz;
    /// 创建 DirBuilder 实例
    /// 并设置 .recursive(true)
    /// 然后调用 .create(path).unwrap();
    ///
    /// assert!(fs::metadata(path).unwrap().is_dir());
    /// ```
    #[stable(feature = "dir_builder", since = "1.6.0")]
    pub fn create<P: AsRef<Path>>(&self, path: P) -> io::Result<()> {
        self._create(path.as_ref())
    }

    fn _create(&self, path: &Path) -> io::Result<()> {
        if self.recursive { self.create_dir_all(path) } else { self.inner.mkdir(path) }
    }

    fn create_dir_all(&self, path: &Path) -> io::Result<()> {
        // if path's parent is None, it is "/" path, which should
        // return Ok immediately
        if path.is_empty() || path.parent().is_none() {
            return Ok(());
        }

        // For certain platforms, a path like "/tmp/foo/.", while the "/tmp" directory exists,
        // the mkdir function may produce a `NotFound` error on that path instead of succeeding
        // due to viewing the "foo" and "." as two separate missing components.
        // See https://github.com/rust-lang/rust/issues/162243
        let path = path.components().as_path();
        let ancestors = path.ancestors();
        let mut uncreated_dirs = 0;

        for ancestor in ancestors {
            // for relative paths like "foo/bar", the parent of
            // "foo" will be "" which there's no need to invoke
            // a mkdir syscall on
            if ancestor.is_empty() || ancestor.parent().is_none() {
                break;
            }

            match self.inner.mkdir(ancestor) {
                Ok(()) => break,
                Err(e) if e.kind() == io::ErrorKind::NotFound => uncreated_dirs += 1,
                // we check if the err is AlreadyExists for two reasons
                //    - in case the path exists as a *file*
                //    - and to avoid calls to .is_dir() in case of other errs
                //      (i.e. PermissionDenied)
                Err(e) if e.kind() == io::ErrorKind::AlreadyExists && ancestor.is_dir() => break,
                Err(e) => return Err(e),
            }
        }

        // collect only the uncreated directories w/o letting the vec resize
        let mut uncreated_dirs_vec = Vec::with_capacity(uncreated_dirs);
        uncreated_dirs_vec.extend(ancestors.take(uncreated_dirs));

        for uncreated_dir in uncreated_dirs_vec.iter().rev() {
            if let Err(e) = self.inner.mkdir(uncreated_dir) {
                if e.kind() != io::ErrorKind::AlreadyExists || !uncreated_dir.is_dir() {
                    return Err(e);
                }
            }
        }

        Ok(())
    }
}

impl AsInnerMut<fs_imp::DirBuilder> for DirBuilder {
    #[inline]
    fn as_inner_mut(&mut self) -> &mut fs_imp::DirBuilder {
        &mut self.inner
    }
}

/// Returns `Ok(true)` if the path points at an existing entity.
///
/// This function will traverse symbolic links to query information about the
/// destination file. In case of broken symbolic links this will return `Ok(false)`.
///
/// As opposed to the [`Path::exists`] method, this will only return `Ok(true)` or `Ok(false)`
/// if the path was _verified_ to exist or not exist. If its existence can neither be confirmed
/// nor denied, an `Err(_)` will be propagated instead. This can be the case if e.g. listing
/// permission is denied on one of the parent directories.
///
/// Note that while this avoids some pitfalls of the `exists()` method, it still can not
/// prevent time-of-check to time-of-use ([TOCTOU]) bugs. You should only use it in scenarios
/// where those bugs are not an issue.
///
/// # Examples
///
/// ```no_run
/// 使用 std::fs;
///
/// assert!(!fs::exists("does_not_exist.txt").expect("无法检查文件 does_not_exist.txt 的存在"));
/// assert!(fs::exists("/root/secret_file.txt").is_err());
/// ```
///
/// [`Path::exists`]: crate::path::Path::exists
/// [TOCTOU]: self#time-of-check-to-time-of-use-toctou
#[stable(feature = "fs_try_exists", since = "1.81.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "fs_exists")]
#[inline]
pub fn exists<P: AsRef<Path>>(path: P) -> io::Result<bool> {
    fs_imp::exists(path.as_ref())
}
