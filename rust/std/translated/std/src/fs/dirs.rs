use crate::path::{Path, PathBuf};
use crate::sys::fs::{ExtraHomeDirs, ExtraMediaDirs};

/// 用于用户特定应用文件的常见用户目录路径。
///
/// 并不要求当前用户能够访问这些用户目录，也不要求该路径下存在目录。一个健壮的应用程序
/// 应该能处理用户目录配置错误的情形。
/// 即使配置正确，多个路径也可能指向同一个位置。
///
/// 即使配置正确，多个路径也可能指向同一个位置。
/// 不要假设相对于某个目录写入的文件不会
/// 与不同主目录中的相同相对路径产生冲突。
///
/// # 平台特定行为
///
/// 由于不同操作系统下发现目录的文件系统约定不同，
/// operating systems, constructors for `HomeDirs` that use the host platform's
/// conventions are provided as extension traits under the `std::os` module.
#[unstable(feature = "fs_home_dirs", issue = "162082")]
#[derive(Debug, Clone)]
pub struct HomeDirs {
    pub(crate) cache: Option<PathBuf>,
    pub(crate) config: Option<PathBuf>,
    pub(crate) data: Option<PathBuf>,
    pub(crate) state: Option<PathBuf>,
    #[cfg_attr(not(unix), expect(dead_code, reason = "no extra home dirs"))]
    pub(crate) extra: ExtraHomeDirs,
}

/// 并不要求媒体目录当前用户能够访问，也不要求该路径下存在目录。一个健壮的应用程序
///
/// 应该能处理媒体目录配置错误的情形。
/// 即使配置正确，多个路径也可能指向同一个位置。
/// 不要假设相对于某个目录写入的文件不会
///
/// 与不同媒体目录中的相同相对路径产生冲突。
/// 不要假设相对于某个目录写入的文件不会
/// 与不同媒体目录中的相同相对路径产生冲突。
///
/// # 平台特定行为
///
/// 由于不同操作系统下发现目录的文件系统约定不同，
/// operating systems, constructors for `MediaDirs` that use the host platform's
/// conventions are provided as extension traits under the `std::os` module.
#[unstable(feature = "fs_media_dirs", issue = "162083")]
#[derive(Debug, Clone)]
pub struct MediaDirs {
    pub(crate) desktop: Option<PathBuf>,
    pub(crate) documents: Option<PathBuf>,
    pub(crate) downloads: Option<PathBuf>,
    pub(crate) music: Option<PathBuf>,
    pub(crate) pictures: Option<PathBuf>,
    pub(crate) videos: Option<PathBuf>,
    #[cfg_attr(not(unix), expect(dead_code, reason = "no extra media dirs"))]
    pub(crate) extra: ExtraMediaDirs,
}

// NB: HomeDirs and MediaDirs intentionally do not implement Default. Self::empty()
//     is a logical default, but users may also intuit the default to use default
//     platform conventions. Omitting Default pushes users to explicitly choose.

impl HomeDirs {
    /// 创建一个已知用户目录集，其中没有已知的目录。
    ///
    /// This is useful with the builder `set_*` methods to create a `HomeDirs`
    /// with exactly the directories you want, without any other defaults.
    #[unstable(feature = "fs_home_dirs", issue = "162082")]
    pub fn empty() -> Self {
        Self { cache: None, config: None, data: None, state: None, extra: Default::default() }
    }

    /// 一个基础目录，该目录用于存储用户特定的非必要缓存数据文件。
    /// “缓存”文件是临时数据，可用于缓存应用程序的冗余工作，但可以被任意丢弃，
    ///
    /// 并在需要时重新创建。此目录中的文件可能随时被自动清除，或者根据系统配置可能不会被清除。一个健壮的应用程序
    /// 应该确保其缓存不会无限制地增长。
    /// 这是所有应用程序使用的同一个目录。应用程序应该
    /// automatically purged any time they are not currently open, or they
    /// may not, depending on system configuration. A robust application
    /// should ensure that its caches do not grow without a reasonable bound.
    ///
    /// This is the same directory for all applications. Applications should
    /// 使用子目录存放特定于应用的缓存文件。
    ///
    /// # 平台特定行为
    ///
    /// 当使用平台特定的约定构建时，其值为：
    ///
    /// | 操作系统 | 路径 |
    /// | -- | ---- |
    /// | [XDG] (Linux) | `${XDG_CACHE_HOME:-$HOME/.cache}` |
    /// | [Darwin] (macOS) | [`NSCachesDirectory`] (`$HOME/Library/Caches`) |
    /// | [Windows] | [`{FOLDERID_LocalAppData}`] (`%LOCALAPPDATA%`) |
    ///
    /// Other paths can be configured via [`set_cache_home`](Self::set_cache_home).
    ///
    /// [XDG]: crate::os::unix::fs::HomeDirsExt
    /// [Darwin]: crate::os::darwin::fs::HomeDirsExt
    /// [Windows]: crate::os::windows::fs::HomeDirsExt
    /// [`NSCachesDirectory`]: https://developer.apple.com/documentation/foundation/filemanager/searchpathdirectory/cachesdirectory?language=objc
    /// [`{FOLDERID_LocalAppData}`]: https://learn.microsoft.com/en-us/windows/win32/shell/knownfolderid#folderid_localappdata
    #[unstable(feature = "fs_home_dirs", issue = "162082")]
    pub fn cache_home(&self) -> Option<&Path> {
        self.cache.as_deref()
    }

    /// 一个相对于用户特定配置文件应存储的基础目录。
    /// “Config”文件由用户管理，可以通过直接编辑这些文件或通过管理应用程序来配置。配置通常
    ///
    /// 对用户具有意义，并且足够可移植，以便在同一用户的多个系统上
    /// 进行备份和同步。
    /// 这是所有应用程序共享的目录。应用程序应
    /// 使用子目录存放特定于应用的配置文件。
    /// # 平台特定行为
    ///
    /// 当使用平台特定的约定构建时，其值为：
    /// | 操作系统 | 路径 |
    ///
    /// # Platform-specific behavior
    ///
    /// 当使用平台特定的约定构建时，其值为：
    ///
    /// | 操作系统 | 路径 |
    /// | -- | ---- |
    /// | [XDG] (Linux) | `${XDG_CONFIG_HOME:-$HOME/.config}` |
    /// | [Darwin] (macOS) | [`NSApplicationSupportDirectory`] (`$HOME/Library/Application Support`) |
    /// | [Windows] | [`{FOLDERID_RoamingAppData}`] (`%APPDATA%`) |
    ///
    /// Other paths can be configured via [`set_config_home`](Self::set_config_home).
    ///
    /// [XDG]: crate::os::unix::fs::HomeDirsExt
    /// [Darwin]: crate::os::darwin::fs::HomeDirsExt
    /// [Windows]: crate::os::windows::fs::HomeDirsExt
    /// [`NSApplicationSupportDirectory`]: https://developer.apple.com/documentation/foundation/filemanager/searchpathdirectory/applicationsupportdirectory?language=objc
    /// [`{FOLDERID_RoamingAppData}`]: https://learn.microsoft.com/en-us/windows/win32/shell/knownfolderid#folderid_roamingappdata
    #[unstable(feature = "fs_home_dirs", issue = "162082")]
    pub fn config_home(&self) -> Option<&Path> {
        self.config.as_deref()
    }

    /// 一个相对于用户特定数据文件应存储的基础目录。
    /// “Data”文件是特定于应用的数据，对用户具有某种意义，且不依赖于系统配置或应用程序安装细节，这些内容与用户无关。因此，数据在多个系统上的同一用户账户之间进行备份和同步是有意义的。如果文件特定于
    ///
    /// "Data" files are application-specific data that is meaningful to the
    /// 这是所有应用程序共享的目录。应用程序应
    /// 使用子目录存放特定于应用的数据文件。
    /// # 平台特定行为
    /// 当使用平台特定的约定构建时，其值为：
    /// a single machine, it's probably [state](Self::state_home).
    ///
    /// This is the same directory for all applications. Applications should
    /// use a subdirectory for application-specific data files.
    ///
    /// # Platform-specific behavior
    ///
    /// 当使用平台特定的约定构建时，其值为：
    ///
    /// | 操作系统 | 路径 |
    /// | -- | ---- |
    /// | [XDG] (Linux) | `${XDG_DATA_HOME:-$HOME/.local/share}` |
    /// | [Darwin] (macOS) | [`NSApplicationSupportDirectory`] (`$HOME/Library/Application Support`) |
    /// | [Windows] | [`{FOLDERID_RoamingAppData}`] (`%APPDATA%`) |
    ///
    /// Other paths can be configured via [`set_data_home`](Self::set_data_home).
    ///
    /// [XDG]: crate::os::unix::fs::HomeDirsExt
    /// [Darwin]: crate::os::darwin::fs::HomeDirsExt
    /// [Windows]: crate::os::windows::fs::HomeDirsExt
    /// [`NSApplicationSupportDirectory`]: https://developer.apple.com/documentation/foundation/filemanager/searchpathdirectory/applicationsupportdirectory?language=objc
    /// [`{FOLDERID_RoamingAppData}`]: https://learn.microsoft.com/en-us/windows/win32/shell/knownfolderid#folderid_roamingappdata
    #[unstable(feature = "fs_home_dirs", issue = "162082")]
    pub fn data_home(&self) -> Option<&Path> {
        self.data.as_deref()
    }

    /// 一个相对于用户特定状态文件应存储的基础目录。
    /// “State”文件是应在应用重启后保留的数据，
    ///
    /// "State" files are data that should persist between application restarts,
    /// but which is not important nor portable enough to the user to synchronize
    /// between multiple systems like [data](Self::data_home) are. Common examples
    /// 包含历史记录（如日志、最近使用的文件等）以及应用程序当前状态
    /// 应被重新使用的应用程序状态（如视图、布局、打开的文件等）
    /// 文件、撤销历史记录等。
    ///
    /// 所有应用程序都使用同一个目录。应用程序应
    /// 使用子目录来存放特定于应用程序的状态文件。
    ///
    /// # 平台特定的行为
    ///
    /// 当使用平台特定的约定构建时，其值为：
    ///
    /// | 操作系统 | 路径 |
    /// | -- | ---- |
    /// | [XDG] (Linux) | `${XDG_STATE_HOME:-$HOME/.local/state}` |
    /// | [Darwin] (macOS) | [`NSApplicationSupportDirectory`] (`$HOME/Library/Application Support`) |
    /// | [Windows] | [`{FOLDERID_LocalAppData}`] (`%LOCALAPPDATA%`) |
    ///
    /// Other paths can be configured via [`set_state_home`](Self::set_state_home).
    ///
    /// [XDG]: crate::os::unix::fs::HomeDirsExt
    /// [Darwin]: crate::os::darwin::fs::HomeDirsExt
    /// [Windows]: crate::os::windows::fs::HomeDirsExt
    /// [`NSApplicationSupportDirectory`]: https://developer.apple.com/documentation/foundation/filemanager/searchpathdirectory/applicationsupportdirectory?language=objc
    /// [`{FOLDERID_LocalAppData}`]: https://learn.microsoft.com/en-us/windows/win32/shell/knownfolderid#folderid_localappdata
    #[unstable(feature = "fs_home_dirs", issue = "162082")]
    pub fn state_home(&self) -> Option<&Path> {
        self.state.as_deref()
    }
}

impl MediaDirs {
    /// 创建一个已知用户目录集，不包含任何已知目录。
    ///
    /// This is useful with the builder `set_*` methods to create a `MediaDirs`
    /// with exactly the directories you want, without any other defaults.
    #[unstable(feature = "fs_media_dirs", issue = "162083")]
    pub fn empty() -> Self {
        Self {
            desktop: None,
            documents: None,
            downloads: None,
            music: None,
            pictures: None,
            videos: None,
            extra: Default::default(),
        }
    }

    /// The OS-recognized user "Desktop" directory, often the `Desktop`
    /// 而不是自动访问的文件路径。
    ///
    /// 作为媒体目录，这通常应被用作文件选择对话框的默认路径
    /// 而不是自动访问的文件路径。
    ///
    /// # 平台特定的行为
    ///
    /// 当使用平台特定的约定构建时，其值为：
    ///
    /// | 操作系统 | 路径 |
    /// | -- | ---- |
    /// | [XDG] (Linux) | `xdg-user-dir DESKTOP` (`$HOME/Desktop`) |
    /// | [Darwin] (macOS) | [`NSDesktopDirectory`] (`$HOME/Desktop`) |
    /// | [Windows] | [`{FOLDERID_Desktop}`] (`%USERPROFILE%\Desktop`) |
    ///
    /// Other paths can be configured via [`set_desktop`](Self::set_desktop).
    ///
    /// [XDG]: crate::os::unix::fs::MediaDirsExt
    /// [Darwin]: crate::os::darwin::fs::MediaDirsExt
    /// [Windows]: crate::os::windows::fs::MediaDirsExt
    /// [`NSDesktopDirectory`]: https://developer.apple.com/documentation/foundation/filemanager/searchpathdirectory/desktopdirectory?language=objc
    /// [`{FOLDERID_Desktop}`]: https://learn.microsoft.com/en-us/windows/win32/shell/knownfolderid#folderid_desktop
    #[unstable(feature = "fs_media_dirs", issue = "162083")]
    pub fn desktop(&self) -> Option<&Path> {
        self.desktop.as_deref()
    }

    /// The OS-recognized user "Documents" directory, often the `Documents`
    /// 作为媒体目录，这通常应被用作文件选择对话框的默认路径
    ///
    /// 而不是自动访问的文件路径。
    /// 作为媒体目录，这通常应被用作文件选择对话框的默认路径
    ///
    /// # 而不是自动访问的文件路径。
    ///
    /// 当使用平台特定的约定构建时，其值为：
    ///
    /// | 操作系统 | 路径 |
    /// | -- | ---- |
    /// | [XDG] (Linux) | `xdg-user-dir DOCUMENTS` (`$HOME/Documents`) |
    /// | [Darwin] (macOS) | [`NSDocumentDirectory`] (`$HOME/Documents`) |
    /// | [Windows] | [`{FOLDERID_Documents}`] (`%USERPROFILE%\Documents`) |
    ///
    /// Other paths can be configured via [`set_documents`](Self::set_documents).
    ///
    /// [XDG]: crate::os::unix::fs::MediaDirsExt
    /// [Darwin]: crate::os::darwin::fs::MediaDirsExt
    /// [Windows]: crate::os::windows::fs::MediaDirsExt
    /// [`NSDocumentDirectory`]: https://developer.apple.com/documentation/foundation/filemanager/searchpathdirectory/documentdirectory?language=objc
    /// [`{FOLDERID_Documents}`]: https://learn.microsoft.com/en-us/windows/win32/shell/knownfolderid#folderid_documents
    #[unstable(feature = "fs_media_dirs", issue = "162083")]
    pub fn documents(&self) -> Option<&Path> {
        self.documents.as_deref()
    }

    /// The OS-recognized user "Downloads" directory, often the `Downloads`
    /// 作为媒体目录，这通常应被用作文件选择对话框的默认路径
    ///
    /// 作为媒体目录，这通常应被用作文件选择对话框的默认路径
    /// 而不是自动访问的文件路径。
    ///
    /// # 平台特定的行为
    ///
    /// 当使用平台特定的约定构建时，其值为：
    ///
    /// | 操作系统 | 路径 |
    /// | -- | ---- |
    /// | [XDG] (Linux) | `xdg-user-dir DOWNLOAD` (`$HOME/Downloads`) |
    /// | [Darwin] (macOS) | [`NSDownloadsDirectory`] (`$HOME/Downloads`) |
    /// | [Windows] | [`{FOLDERID_Downloads}`] (`%USERPROFILE%\Downloads`) |
    ///
    /// Other paths can be configured via [`set_downloads`](Self::set_downloads).
    ///
    /// [XDG]: crate::os::unix::fs::MediaDirsExt
    /// [Darwin]: crate::os::darwin::fs::MediaDirsExt
    /// [Windows]: crate::os::windows::fs::MediaDirsExt
    /// [`NSDownloadsDirectory`]: https://developer.apple.com/documentation/foundation/filemanager/searchpathdirectory/downloadsdirectory?language=objc
    /// [`{FOLDERID_Downloads}`]: https://learn.microsoft.com/en-us/windows/win32/shell/knownfolderid#folderid_downloads
    #[unstable(feature = "fs_media_dirs", issue = "162083")]
    pub fn downloads(&self) -> Option<&Path> {
        self.downloads.as_deref()
    }

    /// The OS-recognized user "Music" directory, often the `Music`
    /// 位于用户主目录中的文件夹。
    ///
    /// 作为媒体目录，这通常应被用作默认路径
    /// 用于文件选择对话框，而非自动访问的文件路径。
    ///
    /// # 平台特定行为
    ///
    /// 当使用平台特定的约定构建时，其值为：
    ///
    /// | 操作系统 | 路径 |
    /// | -- | ---- |
    /// | [XDG] (Linux) | `xdg-user-dir MUSIC` (`$HOME/Music`) |
    /// | [Darwin] (macOS) | [`NSMusicDirectory`] (`$HOME/Music`) |
    /// | [Windows] | [`{FOLDERID_Music}`] (`%USERPROFILE%\Music`) |
    ///
    /// Other paths can be configured via [`set_music`](Self::set_music).
    ///
    /// [XDG]: crate::os::unix::fs::MediaDirsExt
    /// [Darwin]: crate::os::darwin::fs::MediaDirsExt
    /// [Windows]: crate::os::windows::fs::MediaDirsExt
    /// [`NSMusicDirectory`]: https://developer.apple.com/documentation/foundation/filemanager/searchpathdirectory/musicdirectory?language=objc
    /// [`{FOLDERID_Music}`]: https://learn.microsoft.com/en-us/windows/win32/shell/knownfolderid#folderid_music
    #[unstable(feature = "fs_media_dirs", issue = "162083")]
    pub fn music(&self) -> Option<&Path> {
        self.music.as_deref()
    }

    /// The OS-recognized user "Pictures" directory, often the `Pictures`
    /// 位于用户主目录中的文件夹。
    ///
    /// 作为媒体目录，这通常应被用作默认路径
    /// 用于文件选择对话框，而非自动访问的文件路径。
    ///
    /// # 平台特定行为
    ///
    /// 当使用平台特定的约定构建时，其值为：
    ///
    /// | 操作系统 | 路径 |
    /// | -- | ---- |
    /// | [XDG] (Linux) | `xdg-user-dir PICTURES` (`$HOME/Pictures`) |
    /// | [Darwin] (macOS) | [`NSPicturesDirectory`] (`$HOME/Pictures`) |
    /// | [Windows] | [`{FOLDERID_Pictures}`] (`%USERPROFILE%\Pictures`) |
    ///
    /// Other paths can be configured via [`set_pictures`](Self::set_pictures).
    ///
    /// [XDG]: crate::os::unix::fs::MediaDirsExt
    /// [Darwin]: crate::os::darwin::fs::MediaDirsExt
    /// [Windows]: crate::os::windows::fs::MediaDirsExt
    /// [`NSPicturesDirectory`]: https://developer.apple.com/documentation/foundation/filemanager/searchpathdirectory/picturesdirectory?language=objc
    /// [`{FOLDERID_Pictures}`]: https://learn.microsoft.com/en-us/windows/win32/shell/knownfolderid#folderid_pictures
    #[unstable(feature = "fs_media_dirs", issue = "162083")]
    pub fn pictures(&self) -> Option<&Path> {
        self.pictures.as_deref()
    }

    /// The OS-recognized user "Videos" directory, often the `Videos`
    /// 位于用户主目录中的文件夹。
    ///
    /// 作为媒体目录，这通常应被用作默认路径
    /// 用于文件选择对话框，而非自动访问的文件路径。
    ///
    /// # 平台特定行为
    ///
    /// 当使用平台特定的约定构建时，其值为：
    ///
    /// | 操作系统 | 路径 |
    /// | -- | ---- |
    /// | [XDG] (Linux) | `xdg-user-dir VIDEOS` (`$HOME/Videos`) |
    /// | [Darwin] (macOS) | [`NSMoviesDirectory`] (`$HOME/Movies`) |
    /// | [Windows] | [`{FOLDERID_Videos}`] (`%USERPROFILE%\Videos`) |
    ///
    /// Other paths can be configured via [`set_videos`](Self::set_videos).
    ///
    /// [XDG]: crate::os::unix::fs::MediaDirsExt
    /// [Darwin]: crate::os::darwin::fs::MediaDirsExt
    /// [Windows]: crate::os::windows::fs::MediaDirsExt
    /// [`NSMoviesDirectory`]: https://developer.apple.com/documentation/foundation/filemanager/searchpathdirectory/moviesdirectory?language=objc
    /// [`{FOLDERID_Videos}`]: https://learn.microsoft.com/en-us/windows/win32/shell/knownfolderid#folderid_videos
    #[unstable(feature = "fs_media_dirs", issue = "162083")]
    pub fn videos(&self) -> Option<&Path> {
        self.videos.as_deref()
    }
}

impl HomeDirs {
    /// 设置 [Self::cache_home] 的路径。
    ///
    /// # 异常
    ///
    /// 如果提供的路径不是绝对路径，则会发生异常。
    #[unstable(feature = "fs_home_dirs", issue = "162082")]
    pub fn set_cache_home(&mut self, path: PathBuf) -> &mut Self {
        assert!(path.is_absolute(), "cache home directory path must be absolute");
        self.cache = Some(path);
        self
    }

    /// 设置 [Self::config_home] 的路径。
    ///
    /// # 异常
    ///
    /// 如果提供的路径不是绝对路径，则会发生异常。
    #[unstable(feature = "fs_home_dirs", issue = "162082")]
    pub fn set_config_home(&mut self, path: PathBuf) -> &mut Self {
        assert!(path.is_absolute(), "config home directory path must be absolute");
        self.config = Some(path);
        self
    }

    /// 设置 [Self::data_home] 的路径。
    ///
    /// # 异常
    ///
    /// 如果提供的路径不是绝对路径，则会发生异常。
    #[unstable(feature = "fs_home_dirs", issue = "162082")]
    pub fn set_data_home(&mut self, path: PathBuf) -> &mut Self {
        assert!(path.is_absolute(), "data home directory path must be absolute");
        self.data = Some(path);
        self
    }

    /// 设置 [Self::state_home] 的路径。
    ///
    /// # 异常
    ///
    /// 如果提供的路径不是绝对路径，则会发生异常。
    #[unstable(feature = "fs_home_dirs", issue = "162082")]
    pub fn set_state_home(&mut self, path: PathBuf) -> &mut Self {
        assert!(path.is_absolute(), "state home directory path must be absolute");
        self.state = Some(path);
        self
    }
}

impl MediaDirs {
    /// 设置 [Self::desktop] 的路径。
    ///
    /// # 异常
    ///
    /// 如果提供的路径不是绝对路径，则会发生异常。
    #[unstable(feature = "fs_media_dirs", issue = "162083")]
    pub fn set_desktop(&mut self, path: PathBuf) -> &mut Self {
        assert!(path.is_absolute(), "desktop directory path must be absolute");
        self.desktop = Some(path);
        self
    }

    /// 设置 [Self::documents] 的路径。
    ///
    /// # 异常
    ///
    /// 如果提供的路径不是绝对路径，则会发生异常。
    #[unstable(feature = "fs_media_dirs", issue = "162083")]
    pub fn set_documents(&mut self, path: PathBuf) -> &mut Self {
        assert!(path.is_absolute(), "documents directory path must be absolute");
        self.documents = Some(path);
        self
    }

    /// 设置 [Self::downloads] 的路径。
    ///
    /// # 异常
    ///
    /// 如果提供的路径不是绝对路径，则触发 panic 错误。
    #[unstable(feature = "fs_media_dirs", issue = "162083")]
    pub fn set_downloads(&mut self, path: PathBuf) -> &mut Self {
        assert!(path.is_absolute(), "downloads directory path must be absolute");
        self.downloads = Some(path);
        self
    }

    /// 设置 [Self::music] 的路径。
    ///
    /// # panic
    ///
    /// 如果提供的路径不是绝对路径，则触发 panic 错误。
    #[unstable(feature = "fs_media_dirs", issue = "162083")]
    pub fn set_music(&mut self, path: PathBuf) -> &mut Self {
        assert!(path.is_absolute(), "music directory path must be absolute");
        self.music = Some(path);
        self
    }

    /// 设置 [Self::pictures] 的路径。
    ///
    /// # panic
    ///
    /// 如果提供的路径不是绝对路径，则触发 panic 错误。
    #[unstable(feature = "fs_media_dirs", issue = "162083")]
    pub fn set_pictures(&mut self, path: PathBuf) -> &mut Self {
        assert!(path.is_absolute(), "pictures directory path must be absolute");
        self.pictures = Some(path);
        self
    }

    /// 设置 [Self::videos] 的路径。
    ///
    /// # panic
    ///
    /// 如果提供的路径不是绝对路径，则触发 panic 错误。
    #[unstable(feature = "fs_media_dirs", issue = "162083")]
    pub fn set_videos(&mut self, path: PathBuf) -> &mut Self {
        assert!(path.is_absolute(), "videos directory path must be absolute");
        self.videos = Some(path);
        self
    }
}
