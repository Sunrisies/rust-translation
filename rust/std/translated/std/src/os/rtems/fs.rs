#![stable(feature = "metadata_ext", since = "1.1.0")]

use crate::fs::Metadata;
use crate::sys::AsInner;

/// OS-specific extensions to [`fs::Metadata`].
///
/// [`fs::Metadata`]: crate::fs::Metadata
#[stable(feature = "metadata_ext", since = "1.1.0")]
pub trait MetadataExt {
    /// 返回该文件所在的设备 ID。
    ///
    /// # 示例
    ///
    #[cfg_attr(target_os = "rtems", doc = "```no_run")]
    #[cfg_attr(not(target_os = "rtems"), doc = "```ignore (needs rtems)")]
    /// use std::fs;
    /// use std::io;
    /// use std::os::rtems::fs::MetadataExt;
    ///
    /// fn main() -> io::Result<()> {
    /// let meta = fs::metadata("some_file")?;
    /// println!("{}", meta.st_dev());
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext2", since = "1.8.0")]
    fn st_dev(&self) -> u64;

    /// Returns the inode number.
    ///
    /// # Examples
    ///
    #[cfg_attr(target_os = "rtems", doc = "```no_run")]
    #[cfg_attr(not(target_os = "rtems"), doc = "```ignore (needs rtems)")]
    /// use std::fs;
    /// use std::io;
    /// use std::os::rtems::fs::MetadataExt;
    ///
    /// fn main() -> io::Result<()> {
    ///     let meta = fs::metadata("some_file")?;
    ///     println!("{}", meta.st_ino());
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext2", since = "1.8.0")]
    fn st_ino(&self) -> u64;

    /// 返回文件类型和模式。
    ///
    /// # 示例
    ///
    #[cfg_attr(target_os = "rtems", doc = "```no_run")]
    #[cfg_attr(not(target_os = "rtems"), doc = "```ignore (needs rtems)")]
    /// use std::fs;
    /// use std::io;
    /// use std::os::rtems::fs::MetadataExt;
    ///
    /// fn main() -> io::Result<()> {
    /// let meta = fs::metadata("some_file")?;
    /// println!("{}", meta.st_mode());
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext2", since = "1.8.0")]
    fn st_mode(&self) -> u32;

    /// Returns the number of hard links to file.
    ///
    /// # Examples
    ///
    #[cfg_attr(target_os = "rtems", doc = "```no_run")]
    #[cfg_attr(not(target_os = "rtems"), doc = "```ignore (needs rtems)")]
    /// use std::fs;
    /// use std::io;
    /// use std::os::rtems::fs::MetadataExt;
    ///
    /// fn main() -> io::Result<()> {
    ///     let meta = fs::metadata("some_file")?;
    ///     println!("{}", meta.st_nlink());
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext2", since = "1.8.0")]
    fn st_nlink(&self) -> u64;

    /// 返回文件所有者的用户 ID。
    ///
    /// # 示例
    ///
    #[cfg_attr(target_os = "rtems", doc = "```no_run")]
    #[cfg_attr(not(target_os = "rtems"), doc = "```ignore (needs rtems)")]
    /// use std::fs;
    /// use std::io;
    /// use std::os::rtems::fs::MetadataExt;
    ///
    /// fn main() -> io::Result<()> {
    /// let meta = fs::metadata("some_file")?;
    /// println!("{}", meta.st_uid());
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext2", since = "1.8.0")]
    fn st_uid(&self) -> u32;

    /// Returns the group ID of the file owner.
    ///
    /// # Examples
    ///
    #[cfg_attr(target_os = "rtems", doc = "```no_run")]
    #[cfg_attr(not(target_os = "rtems"), doc = "```ignore (needs rtems)")]
    /// use std::fs;
    /// use std::io;
    /// use std::os::rtems::fs::MetadataExt;
    ///
    /// fn main() -> io::Result<()> {
    ///     let meta = fs::metadata("some_file")?;
    ///     println!("{}", meta.st_gid());
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext2", since = "1.8.0")]
    fn st_gid(&self) -> u32;

    /// 返回该文件所代表的设备 ID。仅适用于特殊文件。
    ///
    /// # 示例
    ///
    #[cfg_attr(target_os = "rtems", doc = "```no_run")]
    #[cfg_attr(not(target_os = "rtems"), doc = "```ignore (needs rtems)")]
    /// use std::fs;
    /// use std::io;
    /// use std::os::rtems::fs::MetadataExt;
    ///
    /// fn main() -> io::Result<()> {
    /// let meta = fs::metadata("some_file")?;
    /// println!("{}", meta.st_rdev());
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext2", since = "1.8.0")]
    fn st_rdev(&self) -> u64;

    /// Returns the size of the file (if it is a regular file or a symbolic link) in bytes.
    ///
    /// The size of a symbolic link is the length of the pathname it contains,
    /// without a terminating null byte.
    ///
    /// # Examples
    ///
    #[cfg_attr(target_os = "rtems", doc = "```no_run")]
    #[cfg_attr(not(target_os = "rtems"), doc = "```ignore (needs rtems)")]
    /// use std::fs;
    /// use std::io;
    /// use std::os::rtems::fs::MetadataExt;
    ///
    /// fn main() -> io::Result<()> {
    ///     let meta = fs::metadata("some_file")?;
    ///     println!("{}", meta.st_size());
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext2", since = "1.8.0")]
    fn st_size(&self) -> u64;

    /// 返回文件的最后访问时间，以自 Unix 纪元以来的秒数表示。
    ///
    /// # 示例
    ///
    #[cfg_attr(target_os = "rtems", doc = "```no_run")]
    #[cfg_attr(not(target_os = "rtems"), doc = "```ignore (needs rtems)")]
    /// use std::fs;
    /// use std::io;
    /// use std::os::rtems::fs::MetadataExt;
    ///
    /// fn main() -> io::Result<()> {
    /// let meta = fs::metadata("some_file")?;
    /// println!("{}", meta.st_atime());
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext2", since = "1.8.0")]
    fn st_atime(&self) -> i64;

    /// Returns the last access time of the file, in nanoseconds since [`st_atime`].
    ///
    /// [`st_atime`]: Self::st_atime
    ///
    /// # Examples
    ///
    #[cfg_attr(target_os = "rtems", doc = "```no_run")]
    #[cfg_attr(not(target_os = "rtems"), doc = "```ignore (needs rtems)")]
    /// use std::fs;
    /// use std::io;
    /// use std::os::rtems::fs::MetadataExt;
    ///
    /// fn main() -> io::Result<()> {
    ///     let meta = fs::metadata("some_file")?;
    ///     println!("{}", meta.st_atime_nsec());
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext2", since = "1.8.0")]
    fn st_atime_nsec(&self) -> i64;

    /// 返回文件的最后修改时间，以自 Unix 纪元以来的秒数表示。
    ///
    /// # 示例
    ///
    #[cfg_attr(target_os = "rtems", doc = "```no_run")]
    #[cfg_attr(not(target_os = "rtems"), doc = "```ignore (needs rtems)")]
    /// use std::fs;
    /// use std::io;
    /// use std::os::rtems::fs::MetadataExt;
    ///
    /// fn main() -> io::Result<()> {
    /// let meta = fs::metadata("some_file")?;
    /// println!("{}", meta.st_mtime());
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext2", since = "1.8.0")]
    fn st_mtime(&self) -> i64;

    /// Returns the last modification time of the file, in nanoseconds since [`st_mtime`].
    ///
    /// [`st_mtime`]: Self::st_mtime
    ///
    /// # Examples
    ///
    #[cfg_attr(target_os = "rtems", doc = "```no_run")]
    #[cfg_attr(not(target_os = "rtems"), doc = "```ignore (needs rtems)")]
    /// use std::fs;
    /// use std::io;
    /// use std::os::rtems::fs::MetadataExt;
    ///
    /// fn main() -> io::Result<()> {
    ///     let meta = fs::metadata("some_file")?;
    ///     println!("{}", meta.st_mtime_nsec());
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext2", since = "1.8.0")]
    fn st_mtime_nsec(&self) -> i64;

    /// 返回文件的最后状态更改时间，以自 Unix 纪元以来的秒数表示。
    ///
    /// # 示例
    ///
    #[cfg_attr(target_os = "rtems", doc = "```no_run")]
    #[cfg_attr(not(target_os = "rtems"), doc = "```ignore (needs rtems)")]
    /// use std::fs;
    /// use std::io;
    /// use std::os::rtems::fs::MetadataExt;
    ///
    /// fn main() -> io::Result<()> {
    /// let meta = fs::metadata("some_file")?;
    /// println!("{}", meta.st_ctime());
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext2", since = "1.8.0")]
    fn st_ctime(&self) -> i64;

    /// Returns the last status change time of the file, in nanoseconds since [`st_ctime`].
    ///
    /// [`st_ctime`]: Self::st_ctime
    ///
    /// # Examples
    ///
    #[cfg_attr(target_os = "rtems", doc = "```no_run")]
    #[cfg_attr(not(target_os = "rtems"), doc = "```ignore (needs rtems)")]
    /// use std::fs;
    /// use std::io;
    /// use std::os::rtems::fs::MetadataExt;
    ///
    /// fn main() -> io::Result<()> {
    ///     let meta = fs::metadata("some_file")?;
    ///     println!("{}", meta.st_ctime_nsec());
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext2", since = "1.8.0")]
    fn st_ctime_nsec(&self) -> i64;

    /// 返回高效文件系统 I/O 的“推荐”块大小。
    ///
    /// # 示例
    ///
    #[cfg_attr(target_os = "rtems", doc = "```no_run")]
    #[cfg_attr(not(target_os = "rtems"), doc = "```ignore (needs rtems)")]
    /// use std::fs;
    /// use std::io;
    /// use std::os::rtems::fs::MetadataExt;
    ///
    /// fn main() -> io::Result<()> {
    /// let meta = fs::metadata("some_file")?;
    /// println!("{}", meta.st_blksize());
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext2", since = "1.8.0")]
    fn st_blksize(&self) -> u64;

    /// Returns the number of blocks allocated to the file, 512-byte units.
    ///
    /// # Examples
    ///
    #[cfg_attr(target_os = "rtems", doc = "```no_run")]
    #[cfg_attr(not(target_os = "rtems"), doc = "```ignore (needs rtems)")]
    /// use std::fs;
    /// use std::io;
    /// use std::os::rtems::fs::MetadataExt;
    ///
    /// fn main() -> io::Result<()> {
    ///     let meta = fs::metadata("some_file")?;
    ///     println!("{}", meta.st_blocks());
    ///     Ok(())
    /// }
    /// ```
    #[stable(feature = "metadata_ext2", since = "1.8.0")]
    fn st_blocks(&self) -> u64;
}

#[stable(feature = "metadata_ext", since = "1.1.0")]
impl MetadataExt for Metadata {
    fn st_dev(&self) -> u64 {
        self.as_inner().as_inner().st_dev as u64
    }

    fn st_ino(&self) -> u64 {
        self.as_inner().as_inner().st_ino as u64
    }

    fn st_mode(&self) -> u32 {
        self.as_inner().as_inner().st_mode as u32
    }

    fn st_nlink(&self) -> u64 {
        self.as_inner().as_inner().st_nlink as u64
    }

    fn st_uid(&self) -> u32 {
        self.as_inner().as_inner().st_uid as u32
    }

    fn st_gid(&self) -> u32 {
        self.as_inner().as_inner().st_gid as u32
    }

    fn st_rdev(&self) -> u64 {
        self.as_inner().as_inner().st_rdev as u64
    }

    fn st_size(&self) -> u64 {
        self.as_inner().as_inner().st_size as u64
    }

    fn st_atime(&self) -> i64 {
        self.as_inner().as_inner().st_atim.tv_sec as i64
    }

    fn st_atime_nsec(&self) -> i64 {
        self.as_inner().as_inner().st_atim.tv_nsec as i64
    }

    fn st_mtime(&self) -> i64 {
        self.as_inner().as_inner().st_mtim.tv_sec as i64
    }

    fn st_mtime_nsec(&self) -> i64 {
        self.as_inner().as_inner().st_mtim.tv_nsec as i64
    }

    fn st_ctime(&self) -> i64 {
        self.as_inner().as_inner().st_ctim.tv_sec as i64
    }

    fn st_ctime_nsec(&self) -> i64 {
        self.as_inner().as_inner().st_ctim.tv_nsec as i64
    }

    fn st_blksize(&self) -> u64 {
        self.as_inner().as_inner().st_blksize as u64
    }

    fn st_blocks(&self) -> u64 {
        self.as_inner().as_inner().st_blocks as u64
    }
}
