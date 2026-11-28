use crate::env;
use crate::fs::{HomeDirs, MediaDirs};
use crate::io::{self, ErrorKind, const_error};
use crate::path::PathBuf;

/// Darwin-specific extensions to [`fs::HomeDirs`](HomeDirs).
#[unstable(feature = "fs_home_dirs", issue = "162082")]
pub impl(self) trait HomeDirsExt: Sized {
    /// 加载当前用户的标准用户目录路径。
    ///
    /// 在 iOS、tvOS、watchOS、visionOS 和沙盒化的 macOS 应用中，
    /// 这些目录位于应用程序的容器内。在
    /// the sandbox, these are subdirectories of the `~/Library` directory on
    /// 在 macOS 上。
    ///
    /// 生成的目录路径并不保证是标准的
    /// 目录路径；只要该目录可访问，它们就可以被沙盒重定向。
    /// 路径。
    ///
    /// 加载的常用目录包括：
    ///
    /// | `HomeDirs` | [`NSSearchPathDirectory`] |
    /// | ---------- | ----------------------- |
    /// | [`cache_home`] | [`NSCachesDirectory`] (`~/Library/Caches`) |
    /// | [`config_home`] | [`NSApplicationSupportDirectory`] (`~/Library/Application Support`) |
    /// | [`data_home`] | [`NSApplicationSupportDirectory`] (`~/Library/Application Support`) |
    /// | [`state_home`] | [`NSApplicationSupportDirectory`] (`~/Library/Application Support`) |
    ///
    /// 请注意，应用支持目录用于配置、
    /// 数据和状态目录。通常多个用户
    /// 目录可以被配置到相同的路径，但这是 Apple 平台上的常见
    /// 配置方式，因此更需要注意不要
    /// 假设不同用户目录中的文件不能互相替代。
    ///
    /// # 错误
    ///
    /// Errors if the [user home](env::home_dir) cannot be determined.
    //  Errors due to the underlying sysdir(3) API should never occur, as
    //  - the user domain only has one directory for each search path;
    //  - the user domain always returns subdirectory paths of `~`; and
    //  - the username and OS defined path segments are always valid UTF-8.
    ///
    /// # 实现特定的行为
    ///
    /// Uses the `sysdir(3)` API from `libSystem` to discover the standard
    /// 用户目录。
    ///
    /// 这种行为未来可能会发生变化。我们明确保留的权利之一是加载当前列表中未列出的其他常用
    /// 目录。
    /// 常用目录。
    ///
    /// [`cache_home`]: HomeDirs::cache_home
    /// [`config_home`]: HomeDirs::config_home
    /// [`data_home`]: HomeDirs::data_home
    /// [`state_home`]: HomeDirs::state_home
    ///
    /// [`NSSearchPathDirectory`]: https://developer.apple.com/documentation/foundation/filemanager/searchpathdirectory?language=objc
    /// [`NSCachesDirectory`]: https://developer.apple.com/documentation/foundation/filemanager/searchpathdirectory/cachesdirectory?language=objc
    /// [`NSApplicationSupportDirectory`]: https://developer.apple.com/documentation/foundation/filemanager/searchpathdirectory/applicationsupportdirectory?language=objc
    #[unstable(feature = "fs_home_dirs", issue = "162082")]
    fn sysdir() -> io::Result<Self>;
}

/// Darwin-specific extensions to [`fs::MediaDirs`](MediaDirs).
#[unstable(feature = "fs_media_dirs", issue = "162083")]
pub impl(self) trait MediaDirsExt: Sized {
    /// 加载当前用户的标准用户目录路径。
    ///
    /// 生成的目录路径并不保证是标准的
    /// 目录路径；它们可以被沙盒重定向。
    /// 路径，只要该目录可访问。
    ///
    /// 加载的常用目录包括：
    ///
    /// | `MediaDirs` | [`NSSearchPathDirectory`] |
    /// | ---------- | ----------------------- |
    /// | [`desktop`] | [`NSDesktopDirectory`] (`~/Desktop`) |
    /// | [`documents`] | [`NSDocumentDirectory`] (`~/Documents`) |
    /// | [`downloads`] | [`NSDownloadsDirectory`] (`~/Downloads`) |
    /// | [`music`] | [`NSMusicDirectory`] (`~/Music`) |
    /// | [`pictures`] | [`NSPicturesDirectory`] (`~/Pictures`) |
    /// | [`videos`] | [`NSMoviesDirectory`] (`~/Movies`) |
    ///
    /// # 错误
    ///
    /// Errors if the the [user home](env::home_dir) cannot be determined.
    //  Errors due to the underlying sysdir(3) API should never occur, as
    //  - the user domain only has one directory for each search path;
    //  - the user domain always returns subdirectory paths of `~`;
    //  - the username plus OS defined path segments cannot exceed PATH_MAX; and
    //  - the username and OS defined path segments are always valid UTF-8.
    ///
    /// # 实现特定的行为
    ///
    /// Uses the `sysdir(3)` API from `libSystem` to discover the standard
    /// 用户目录。
    ///
    /// 这种行为未来可能会发生变化。我们明确保留的权利之一是加载当前列表中未列出的其他常用
    /// 目录。
    /// 常用目录。
    ///
    /// [`desktop`]: MediaDirs::desktop
    /// [`documents`]: MediaDirs::documents
    /// [`downloads`]: MediaDirs::downloads
    /// [`music`]: MediaDirs::music
    /// [`pictures`]: MediaDirs::pictures
    /// [`videos`]: MediaDirs::videos
    ///
    /// [`NSSearchPathDirectory`]: https://developer.apple.com/documentation/foundation/filemanager/searchpathdirectory?language=objc
    /// [`NSDesktopDirectory`]: https://developer.apple.com/documentation/foundation/filemanager/searchpathdirectory/desktopdirectory?language=objc
    /// [`NSDocumentDirectory`]: https://developer.apple.com/documentation/foundation/filemanager/searchpathdirectory/documentdirectory?language=objc
    /// [`NSDownloadsDirectory`]: https://developer.apple.com/documentation/foundation/filemanager/searchpathdirectory/downloadsdirectory?language=objc
    /// [`NSMusicDirectory`]: https://developer.apple.com/documentation/foundation/filemanager/searchpathdirectory/musicdirectory?language=objc
    /// [`NSPicturesDirectory`]: https://developer.apple.com/documentation/foundation/filemanager/searchpathdirectory/picturesdirectory?language=objc
    /// [`NSMoviesDirectory`]: https://developer.apple.com/documentation/foundation/filemanager/searchpathdirectory/moviesdirectory?language=objc
    #[unstable(feature = "fs_media_dirs", issue = "162083")]
    fn sysdir() -> io::Result<Self>;
}

fn user_home() -> io::Result<PathBuf> {
    env::home_dir()
        .filter(|p| p.is_absolute())
        .ok_or(const_error!(ErrorKind::InvalidData, "home path not absolute"))
}

#[unstable(feature = "fs_home_dirs", issue = "162082")]
#[cfg(target_vendor = "apple")]
impl HomeDirsExt for HomeDirs {
    fn sysdir() -> io::Result<Self> {
        use libc::sysdir_search_path_directory_t::*;

        let mut dirs = HomeDirs::empty();
        let home = user_home()?;

        let caches = sys::get_user_dir(&home, SYSDIR_DIRECTORY_CACHES)?;
        let application_support = sys::get_user_dir(&home, SYSDIR_DIRECTORY_APPLICATION_SUPPORT)?;

        dirs.cache = caches;
        // Apple puts config/data/state all in Application Support
        dirs.config = application_support.clone();
        dirs.data = application_support.clone();
        dirs.state = application_support;

        Ok(dirs)
    }
}

#[unstable(feature = "fs_media_dirs", issue = "162083")]
#[cfg(target_vendor = "apple")]
impl MediaDirsExt for MediaDirs {
    fn sysdir() -> io::Result<Self> {
        use libc::sysdir_search_path_directory_t::*;

        let mut dirs = MediaDirs::empty();
        let home = user_home()?;

        let desktop = sys::get_user_dir(&home, SYSDIR_DIRECTORY_DESKTOP)?;
        let documents = sys::get_user_dir(&home, SYSDIR_DIRECTORY_DOCUMENT)?;
        let downloads = sys::get_user_dir(&home, SYSDIR_DIRECTORY_DOWNLOADS)?;
        let movies = sys::get_user_dir(&home, SYSDIR_DIRECTORY_MOVIES)?;
        let music = sys::get_user_dir(&home, SYSDIR_DIRECTORY_MUSIC)?;
        let pictures = sys::get_user_dir(&home, SYSDIR_DIRECTORY_PICTURES)?;

        dirs.desktop = desktop;
        dirs.documents = documents;
        dirs.downloads = downloads;
        dirs.music = music;
        dirs.pictures = pictures;
        dirs.videos = movies;

        Ok(dirs)
    }
}

/// 对 sysdir(3) API 的更安全的包装器。
#[cfg(target_vendor = "apple")]
mod sys {
    use crate::ffi::{CStr, c_char};
    use crate::io::{self, ErrorKind, const_error};
    use crate::path::{Path, PathBuf};

    /// Get the path for a system directory using `sysdir(3)`.
    pub fn get_user_dir(
        home: &Path,
        kind: libc::sysdir_search_path_directory_t,
    ) -> io::Result<Option<PathBuf>> {
        use libc::sysdir_search_path_domain_mask_t::SYSDIR_DOMAIN_MASK_USER;

        // SAFETY: SYSDIR_DOMAIN_MASK_USER < SYSDIR_DOMAIN_MASK_ALL
        let mut iter = unsafe { Iter::new(home, kind, SYSDIR_DOMAIN_MASK_USER) };
        let Some(path) = iter.next() else {
            return Ok(None);
        };
        let path = path?;

        if iter.next().is_some() {
            // more than one path returned (shouldn't happen for SYSDIR_DOMAIN_MASK_USER)
            return Err(const_error!(
                ErrorKind::InvalidData,
                "multiple paths returned for standard user directory",
            ));
        }

        Ok(Some(path))
    }

    struct Iter<'a> {
        home: &'a Path,
        state: libc::sysdir_search_path_enumeration_state,
    }

    impl Drop for Iter<'_> {
        fn drop(&mut self) {
            for _ in self {}
        }
    }

    impl<'a> Iter<'a> {
        // SAFETY: `mask` must be <= `SYSDIR_DOMAIN_MASK_ALL`
        pub unsafe fn new(
            home: &'a Path,
            kind: libc::sysdir_search_path_directory_t,
            mask: libc::sysdir_search_path_domain_mask_t,
        ) -> Self {
            // SAFETY: forwarded to the caller
            let state = unsafe { libc::sysdir_start_search_path_enumeration(kind, mask) };
            Self { home, state }
        }
    }

    impl Iterator for Iter<'_> {
        type Item = io::Result<PathBuf>;

        fn next(&mut self) -> Option<io::Result<PathBuf>> {
            let mut buf = [0u8; libc::PATH_MAX as usize];
            if self.state != 0 {
                // SAFETY: `self.state` is nonzero and comes from prior sysdir_{start|get_next}_search_path_enumeration call
                // SAFETY: sysdir_get_next_search_path_enumeration will write at most `PATH_MAX` bytes to `path`
                self.state = unsafe {
                    libc::sysdir_get_next_search_path_enumeration(
                        self.state,
                        buf.as_mut_ptr() as *mut c_char,
                    )
                };
            }

            if self.state == 0 {
                // exhausted
                return None;
            }

            let Ok(path) = CStr::from_bytes_until_nul(&buf) else {
                // should be impossible given home-relative paths, but be defensive
                return Some(Err(const_error!(
                    ErrorKind::InvalidData,
                    "standard user directory path too long",
                )));
            };

            let Ok(path) = path.to_str() else {
                // should be impossible on a working system, but be defensive
                return Some(Err(const_error!(
                    ErrorKind::InvalidData,
                    "standard user directory path not valid UTF-8",
                )));
            };

            // expand `~` shorthand
            Some(match path {
                "~" => Ok(self.home.into()),
                _ if path.starts_with("~/") => Ok(self.home.join(&path[2..])),
                _ if path.starts_with("~") => Err(const_error!(
                    ErrorKind::InvalidData,
                    "standard user directory relative to different user",
                )),
                _ => {
                    let path = PathBuf::from(path);
                    if path.is_relative() {
                        Err(const_error!(
                            ErrorKind::InvalidData,
                            "standard user directory path not absolute",
                        ))
                    } else {
                        Ok(path)
                    }
                }
            })
        }
    }
}

#[cfg(test)]
#[cfg(target_vendor = "apple")]
#[cfg(not(skip_unsupported_miri_tests))] // macOS sysdir APIs are not supported in Miri
mod tests {
    use super::*;

    #[test]
    fn can_fetch_sysdir_paths() {
        let dirs = HomeDirs::sysdir().unwrap();
        assert!(dirs.cache_home().is_some());
        assert!(dirs.config_home().is_some());
        assert!(dirs.data_home().is_some());
        assert!(dirs.state_home().is_some());

        let dirs = MediaDirs::sysdir().unwrap();
        assert!(dirs.desktop().is_some());
        assert!(dirs.documents().is_some());
        assert!(dirs.downloads().is_some());
        assert!(dirs.music().is_some());
        assert!(dirs.pictures().is_some());
        assert!(dirs.videos().is_some());
    }
}
