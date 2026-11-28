use crate::env::{self, SplitPathsRef};
use crate::ffi::{OsStr, OsString};
use crate::fs::{self, HomeDirs, MediaDirs};
use crate::io::{self, ErrorKind, const_error};
use crate::macros::rustdoc_skip_body;
use crate::path::{Path, PathBuf};

#[derive(Debug, Default, Clone)]
#[non_exhaustive]
pub struct ExtraHomeDirs {
    runtime: Option<PathBuf>,
    config_path: Option<OsString>,
    data_path: Option<OsString>,
}

#[derive(Debug, Default, Clone)]
#[non_exhaustive]
pub struct ExtraMediaDirs {
    templates: Option<PathBuf>,
}

/// XDG-specific extensions to [`fs::HomeDirs`](HomeDirs).
///
/// XDG 约定由 Freedesktop.org 项目定义。
/// [XDG Base Directory Specification][xdg-basedir]。这些约定已被
/// 大多数 Linux 发行版采用。
///
/// XDG 约定旨在可在任何类 Unix 文件系统上使用，
/// thus this extension being provided in `os::unix` rather than `os::linux`.
/// 然而，虽然某些工具在 macOS 上确实使用 XDG 约定，但请注意
/// macOS 有自己独立的用户目录约定。请仔细考虑
/// 您的用户期望应用程序遵循哪些约定以及您可能需要支持的旧路径兼容性。
/// 根据
///
/// [xdg-basedir]: https://specifications.freedesktop.org/basedir/
#[unstable(feature = "fs_home_dirs", issue = "162082")]
pub impl(self) trait HomeDirsExt: Sized {
    /// [XDG Base Directory Specification][xdg-basedir] 加载用户目录路径。
    /// 每个基础目录路径设置为其对应
    ///
    /// Each base directory path is set to the value of its corresponding
    /// `XDG_*` environment variable (if it is set and non-empty), else to
    /// 规范中定义的默认值。
    ///
    /// | 字段 | 环境变量 | 默认值 |
    /// | ----- | -------------------- | ------------- |
    /// | [`cache_home`] | `XDG_CACHE_HOME` | `$HOME/.cache` |
    /// | [`config_home`] | `XDG_CONFIG_HOME` | `$HOME/.config` |
    /// | [`data_home`] | `XDG_DATA_HOME` | `$HOME/.local/share` |
    /// | [`state_home`] | `XDG_STATE_HOME` | `$HOME/.local/state` |
    /// | [`runtime_home`] | `XDG_RUNTIME_DIR` | (see method docs) |
    /// | [`config_dirs`] | `XDG_CONFIG_DIRS` | `/etc/xdg` |
    /// | [`data_dirs`] | `XDG_DATA_DIRS` | `/usr/local/share/`, `/usr/share/` |
    ///
    /// Note that `$HOME` here means [`env::home_dir`], which uses
    /// `$HOME` if set and non-empty, but falls back to the system password
    /// 数据库，如果未设置。
    ///
    /// 所有路径必须是绝对路径。如果通过环境配置了相对路径，
    /// 则被忽略，使用默认值。
    ///
    /// `config_dirs` and `data_dirs` are a list of delimited paths using the
    /// [`env::split_paths`] delimiter. If some but not all paths in the list are
    /// 相对路径，这些相对路径将被忽略，剩余的绝对
    /// 路径将被使用。如果没有有效的绝对路径，则使用默认值。
    /// 替代目录具有类似功能，并打印警告消息。
    ///
    /// # 错误
    ///
    /// 如果无法确定用户的主目录，则出现错误。
    ///
    /// [xdg-basedir]: https://specifications.freedesktop.org/basedir/
    /// [`cache_home`]: HomeDirs::cache_home
    /// [`config_home`]: HomeDirs::config_home
    /// [`data_home`]: HomeDirs::data_home
    /// [`state_home`]: HomeDirs::state_home
    /// [`runtime_home`]: HomeDirsExt::runtime_home
    /// [`config_dirs`]: HomeDirsExt::config_dirs
    /// [`data_dirs`]: HomeDirsExt::data_dirs
    /// [`env::split_paths`]: crate::env::split_paths
    #[unstable(feature = "fs_home_dirs", issue = "162082")]
    fn xdg() -> io::Result<Self>;

    /// 一个相对于用户特定运行时文件
    /// （如套接字、命名管道等）应存储的基础目录。
    ///
    /// 此目录中的文件可能会定期被清理。
    /// 较大的文件不应放在这里，因为它可能位于
    /// 运行内存中，不一定能交换到磁盘。
    ///
    /// 如果未设置，此路径没有默认值。如果未设置，
    /// 应用程序应回退到具有类似功能的替代目录并打印警告消息。
    /// similar capabilities and print a warning message.
    #[unstable(feature = "fs_home_dirs", issue = "162082")]
    fn runtime_home(&self) -> Option<&Path>;

    /// A preference-ordered list of base directories to search for config
    /// files *in addition to* [`config_home`].
    ///
    /// 目录的顺序表示其重要性；第一个目录
    /// is the most important. Information defined relative to the more
    /// important base directory takes precedent. [`config_home`] is not
    /// 是一个按优先级排序的基础目录列表，用于查找数据文件
    /// than any base directory in this list.
    ///
    /// [`config_home`]: HomeDirs::config_home
    #[unstable(feature = "fs_home_dirs", issue = "162082")]
    fn config_dirs(&self) -> Option<XdgDirs<'_>>;

    /// 为搜索数据而设置的基础目录列表，按优先级排列
    /// files *in addition to* [`data_home`].
    ///
    /// 目录的顺序表示其重要性；第一个目录
    /// is the most important. Information defined relative to the more
    /// important base directory takes precedent. [`data_home`] is not
    /// 是一个按优先级排序的基础目录列表，用于查找数据文件
    /// than any base directory in this list.
    ///
    /// [`data_home`]: HomeDirs::data_home
    #[unstable(feature = "fs_home_dirs", issue = "162082")]
    fn data_dirs(&self) -> Option<XdgDirs<'_>>;

    /// 设置 [Self::runtime_home] 的路径。
    ///
    /// # Panics
    ///
    /// 如果提供的路径不是绝对路径，则发生 panic。
    #[unstable(feature = "fs_home_dirs", issue = "162082")]
    fn set_runtime_home(&mut self, path: PathBuf) -> &mut Self;

    /// 设置 [Self::config_dirs] 的路径。
    ///
    /// Takes one or more paths joined appropriately for the `PATH` environment
    /// variable, as by [`env::join_paths`].
    ///
    /// # Panics
    ///
    /// 如果提供的任何路径不是绝对路径，则发生 panic。
    #[unstable(feature = "fs_home_dirs", issue = "162082")]
    fn set_config_dirs(&mut self, paths: OsString) -> &mut Self;

    /// 设置 [Self::data_dirs] 的路径。
    ///
    /// Takes one or more paths joined appropriately for the `PATH` environment
    /// variable, as by [`env::join_paths`].
    ///
    /// # Panics
    ///
    /// 如果提供的任何路径不是绝对路径，则发生 panic。
    #[unstable(feature = "fs_home_dirs", issue = "162082")]
    fn set_data_dirs(&mut self, paths: OsString) -> &mut Self;
}

/// XDG-specific extensions to [`fs::MediaDirs`](MediaDirs).
///
/// XDG 规范由 Freedesktop.org 项目通过
/// [xdg-user-dirs] 工具定义。这种配置通常存在于桌面
/// Linux 发行版中，尽管其采用程度不如基础目录规范那么广泛。
/// 。
///
/// XDG 规范被设计为可在任何类 Unix 文件系统中使用，
/// thus this extension being provided in `os::unix` rather than `os::linux`.
/// 然而，虽然某些工具在 macOS 上确实使用 XDG 规范，但请注意
/// macOS 有自己独立的用户目录规范。请仔细考虑您的用户期望您的应用程序遵循哪些规范。
/// 以及您可能需要支持的任何旧路径兼容性。
/// 根据 [xdg-user-dirs] 工具加载用户目录路径。
///
/// [xdg-user-dirs]: https://www.freedesktop.org/wiki/Software/xdg-user-dirs/
#[unstable(feature = "fs_media_dirs", issue = "162083")]
pub impl(self) trait MediaDirsExt: Sized {
    /// Load the user directory paths according to the [xdg-user-dirs] tool.
    ///
    /// This directly reads and parses the `$XDG_CONFIG_HOME/user-dirs.dirs`
    /// 文件。
    ///
    /// # Errors
    ///
    /// Errors if the user's home directory cannot be determined or if the
    /// `$XDG_CONFIG_HOME/user-dirs.dirs` file cannot be read.
    ///
    /// # Implementation-specific behavior
    ///
    /// 仅支持 xdg-user-dirs-update 维护的格式。任何
    /// 如果配置格式不符合预期，将会导致
    /// loading an unspecified path or `None` for that directory. To be more
    /// 具体：
    ///
    /// - Any line not in the format of `XDG_{NAME}_DIR={path}` where `{NAME}`
    ///   is one of `DESKTOP`, `DOWNLOAD`, `TEMPLATES`, `PUBLICSHARE`,
    ///   `DOCUMENTS`, `MUSIC`, `PICTURES`, or `VIDEOS` is ignored.
    /// - `{path}` must be a `"`-quoted shell-escaped path.
    /// - `{path}` may only start with `/` or `$HOME/`. A home-relative path
    ///   is returned relative to [`env::home_dir`]; shell expansion is not
    ///   performed.
    /// - A directory set to just `$HOME` marks it as removed, and results in
    ///   a `None` value for that path.
    /// - If shell expansion syntax other than a leading `$HOME` is present,
    /// 这种行为未来可能会发生变化。一个示例变化是：
    /// 我们明确保留加载目前被忽略的路径的权利，例如那些不被
    ///
    /// This behavior may change in the future. One example change that we
    /// explicitly reserve the right to make is to load paths that we currently
    /// 作为媒体目录，通常应作为文件选择对话框的默认路径使用，而不是自动访问的文件路径。
    /// xdg-user-dirs but which may occur in manually-edited `user-dirs.dirs`.
    ///
    /// [xdg-user-dirs]: https://www.freedesktop.org/wiki/Software/xdg-user-dirs/
    #[unstable(feature = "fs_media_dirs", issue = "162083")]
    fn xdg() -> io::Result<Self>;

    /// The OS-privileged user "Templates" directory, often the `Templates`
    /// 如果提供的路径不是绝对路径，则会发生恐慌。
    ///
    /// As a media directory, this should typically be used as a default path
    /// for file selection dialogs, not for automatically accessed file paths.
    #[unstable(feature = "fs_media_dirs", issue = "162083")]
    fn templates(&self) -> Option<&Path>;

    /// Set the paths for [Self::templates].
    ///
    /// # Panics
    ///
    /// Panics if the provided path is not absolute.
    #[unstable(feature = "fs_media_dirs", issue = "162083")]
    fn set_templates(&mut self, path: PathBuf) -> &mut Self;
}

#[unstable(feature = "fs_home_dirs", issue = "162082")]
#[derive(Debug)]
pub struct XdgDirs<'a>(SplitPathsRef<'a>);

#[unstable(feature = "fs_home_dirs", issue = "162082")]
impl HomeDirsExt for HomeDirs {
    fn xdg() -> io::Result<Self> {
        let mut dirs = HomeDirs::empty();
        let user_home = xdg::user_home()?;

        dirs.set_cache_home(xdg::dir_or_else(|| user_home.join(".cache"), "XDG_CACHE_HOME"));
        dirs.set_config_home(xdg::dir_or_else(|| user_home.join(".config"), "XDG_CONFIG_HOME"));
        dirs.set_data_home(xdg::dir_or_else(|| user_home.join(".local/share"), "XDG_DATA_HOME"));
        dirs.set_state_home(xdg::dir_or_else(|| user_home.join(".local/state"), "XDG_STATE_HOME"));
        if let Some(runtime) = xdg::dir("XDG_RUNTIME_DIR") {
            dirs.set_runtime_home(runtime);
        }

        dirs.set_config_dirs(xdg::dirs_or("/etc/xdg", "XDG_CONFIG_DIRS"));
        dirs.set_data_dirs(xdg::dirs_or("/usr/local/share/:/usr/share/", "XDG_DATA_DIRS"));

        Ok(dirs)
    }

    #[rustdoc_skip_body]
    fn runtime_home(&self) -> Option<&Path> {
        self.extra.runtime.as_deref()
    }

    #[rustdoc_skip_body]
    fn config_dirs(&self) -> Option<XdgDirs<'_>> {
        self.extra.config_path.as_deref().map(XdgDirs::new)
    }

    #[rustdoc_skip_body]
    fn data_dirs(&self) -> Option<XdgDirs<'_>> {
        self.extra.data_path.as_deref().map(XdgDirs::new)
    }

    fn set_runtime_home(&mut self, path: PathBuf) -> &mut Self {
        assert!(path.is_absolute(), "runtime directory path must be absolute");
        self.extra.runtime = Some(path);
        self
    }

    fn set_config_dirs(&mut self, paths: OsString) -> &mut Self {
        for path in split_paths_ref(&paths) {
            assert!(path.is_absolute(), "config directory paths must be absolute");
        }
        self.extra.config_path = Some(paths);
        self
    }

    fn set_data_dirs(&mut self, paths: OsString) -> &mut Self {
        for path in split_paths_ref(&paths) {
            assert!(path.is_absolute(), "data directory paths must be absolute");
        }
        self.extra.data_path = Some(paths);
        self
    }
}

#[unstable(feature = "fs_media_dirs", issue = "162083")]
impl MediaDirsExt for MediaDirs {
    fn xdg() -> io::Result<Self> {
        let user_home = xdg::user_home()?;
        let config_home = xdg::dir_or_else(|| user_home.join(".config"), "XDG_CONFIG_HOME");

        let spec = match fs::read(config_home.join("user-dirs.dirs")) {
            Ok(spec) => spec,
            Err(e) if e.kind() == ErrorKind::NotFound => {
                return Err(const_error!(
                    ErrorKind::NotFound,
                    "missing `$XDG_CONFIG_HOME/user-dirs.dirs`",
                ));
            }
            Err(e) => return Err(e),
        };

        Ok(xdg::parse_user_dirs(&spec, &user_home))
    }

    #[rustdoc_skip_body]
    fn templates(&self) -> Option<&Path> {
        self.extra.templates.as_deref()
    }

    fn set_templates(&mut self, path: PathBuf) -> &mut Self {
        assert!(path.is_absolute(), "templates directory path must be absolute");
        self.extra.templates = Some(path);
        self
    }
}

impl<'a> XdgDirs<'a> {
    fn new(paths: &'a OsStr) -> Self {
        XdgDirs(split_paths_ref(paths))
    }
}

#[unstable(feature = "fs_home_dirs", issue = "162082")]
impl<'a> Iterator for XdgDirs<'a> {
    type Item = &'a Path;

    fn next(&mut self) -> Option<Self::Item> {
        self.0.next()
    }
}

fn split_paths_ref<'a>(paths: &'a OsStr) -> SplitPathsRef<'a> {
    // returns Some on cfg(unix)
    env::split_paths_ref(paths).unwrap()
}

mod xdg {
    use super::{MediaDirs, split_paths_ref};
    use crate::env::{self, join_paths, var_os};
    use crate::ffi::OsString;
    use crate::io::{self, ErrorKind, const_error};
    use crate::macros::rustdoc_skip_body;
    use crate::ops::Deref;
    use crate::os::unix::ffi::{OsStrExt, OsStringExt};
    use crate::path::{Path, PathBuf};

    pub fn user_home() -> io::Result<PathBuf> {
        env::home_dir()
            .filter(|p| p.is_absolute())
            .ok_or(const_error!(ErrorKind::InvalidData, "user home directory path not absolute"))
    }

    pub fn dir(env: &str) -> Option<PathBuf> {
        var_os(env).filter(|s| !s.is_empty()).map(PathBuf::from).filter(|path| path.is_absolute())
    }

    pub fn dir_or_else(fallback: impl FnOnce() -> PathBuf, env: &str) -> PathBuf {
        dir(env).unwrap_or_else(fallback)
    }

    fn dirs(env: &str) -> Option<OsString> {
        let dirs = var_os(env).filter(|s| !s.is_empty())?;
        if split_paths_ref(&dirs).all(|p| p.is_absolute()) {
            return Some(dirs);
        }

        struct DerefAsRef<T>(pub T);
        impl<T: Deref<Target: AsRef<U>>, U: ?Sized> AsRef<U> for DerefAsRef<T> {
            fn as_ref(&self) -> &U {
                (*self.0).as_ref()
            }
        }

        let paths = split_paths_ref(&dirs).filter(|p| p.is_absolute()).map(DerefAsRef);
        join_paths(paths).ok().filter(|s| !s.is_empty())
    }

    pub fn dirs_or(fallback: impl Into<OsString>, env: &str) -> OsString {
        dirs(env).unwrap_or_else(|| fallback.into())
    }

    #[rustdoc_skip_body]
    pub fn parse_user_dirs<'a>(spec: &'a [u8], user_home: &Path) -> MediaDirs {
        let mut dirs = MediaDirs::empty();

        for (xdg, path) in
            spec.split(|&b| b == b'\n').flat_map(|line| parse_user_dirs_line(line, user_home))
        {
            // load the known user directories
            match xdg {
                b"XDG_DESKTOP_DIR" => dirs.desktop = path,
                b"XDG_DOCUMENTS_DIR" => dirs.documents = path,
                b"XDG_DOWNLOAD_DIR" => dirs.downloads = path,
                b"XDG_MUSIC_DIR" => dirs.music = path,
                b"XDG_PICTURES_DIR" => dirs.pictures = path,
                b"XDG_VIDEOS_DIR" => dirs.videos = path,
                b"XDG_TEMPLATES_DIR" => dirs.extra.templates = path,
                b"XDG_PUBLICSHARE_DIR" => {
                    // we don't expose this directory yet as Windows also has a "public" directory
                    // and it's not yet clear if we want to expose this at the target-agnostic level
                }
                _ => {
                    // ignore unknown variable assignment
                }
            }
        }

        dirs
    }

    fn parse_user_dirs_line<'a>(
        line: &'a [u8],
        user_home: &Path,
    ) -> Option<(&'a [u8], Option<PathBuf>)> {
        // trim whitespace
        let trimmed = line.trim_ascii();
        // skip empty lines and comments
        if trimmed.is_empty() || trimmed.starts_with(&[b'#']) {
            return None;
        }

        // only variable assignment lines are allowed; split on `=`
        let mut split = trimmed.splitn(2, |&b| b == b'=');
        // extract assignment parts; ignore lines not in this format
        let var = split.next()?;
        let val = split.next()?;
        debug_assert_eq!(split.next(), None);

        // the path value is quoted; unquote it
        let path = unquote(val, user_home)?;

        let path = Some(path)
            // ignore non-absolute paths
            .filter(|path| path.is_absolute())
            // setting to the home dir disables the directory configuration
            .filter(|path| path != user_home);

        Some((var, path))
    }

    fn unquote(bytes: &[u8], user_home: &Path) -> Option<PathBuf> {
        let [b'"', rest @ .., b'"'] = bytes else { return None };

        // setting to the home dir disables the directory configuration;
        // if done symbolically, return None here and bypass later work
        if matches!(rest, b"$HOME" | b"$HOME/") {
            return None;
        }

        let mut rest = rest;
        let mut s = Vec::with_capacity(rest.len());

        // expand leading $HOME
        if rest.starts_with(b"$HOME/") {
            s.extend_from_slice(user_home.as_os_str().as_bytes());
            if !user_home.has_trailing_sep() {
                s.push(b'/');
            }
            rest = &rest[6..];
        }

        loop {
            let i = rest
                .iter()
                .position(|&b| matches!(b, b'"' | b'\\' | b'$' | b'`'))
                .unwrap_or(rest.len());
            s.extend_from_slice(&rest[..i]);
            match &rest[i..] {
                [] => break,
                [b'\\', c @ (b'"' | b'\\' | b'$' | b'`'), tail @ ..] => {
                    // supported escapes
                    s.push(*c);
                    rest = tail;
                }
                [b'"' | b'\\' | b'$' | b'`', ..] => {
                    // unsupported shell syntax
                    return None;
                }
                _ => {
                    if cfg!(debug_assertions) {
                        unreachable!()
                    } else {
                        return None;
                    }
                }
            }
        }

        Some(PathBuf::from(OsString::from_vec(s)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn can_fetch_xdg_base_dirs() {
        let dirs = HomeDirs::xdg().unwrap();

        assert!(dirs.cache_home().is_some());
        assert!(dirs.config_home().is_some());
        assert!(dirs.data_home().is_some());
        assert!(dirs.state_home().is_some());
        // dirs.runtime() may not exist
        assert!(dirs.config_dirs().is_some());
        assert!(dirs.data_dirs().is_some());
    }

    #[test]
    fn can_fetch_xdg_media_dirs() {
        let dirs = match MediaDirs::xdg() {
            Ok(dirs) => dirs,
            Err(e) if e.kind() == ErrorKind::NotFound => {
                // xdg-user-dirs not initialized on this system, skip the test
                return;
            }
            Err(e) => panic!("failed to fetch xdg user dirs: {e:?}"),
        };

        // even when user-dirs.dirs is present, directories may be unset,
        // so we can't assert anything about the dir paths here
        let _ = dirs;
    }

    #[test]
    fn test_well_user_dirs_parsing() {
        const TEST_USERDIRS: &'static str = r#"
# This file is written by xdg-user-dirs-update
# If you want to change or add directories, just edit the line you're
# interested in. All local changes will be retained on the next run.
# Format is XDG_xxx_DIR="$HOME/yyy", where yyy is a shell-escaped
# homedir-relative path, or XDG_xxx_DIR="/yyy", where /yyy is an
# absolute path. No other format is supported.
#
XDG_DESKTOP_DIR="$HOME/Desktop"
XDG_DOWNLOAD_DIR="$HOME/Downloads"
XDG_TEMPLATES_DIR="/pub/Templates"
XDG_PUBLICSHARE_DIR="/pub"
XDG_DOCUMENTS_DIR="$HOME/Documents"
XDG_MUSIC_DIR="$HOME/My \"Music\""
XDG_PICTURES_DIR="$HOME/Pictures"
XDG_VIDEOS_DIR="$HOME"
"#;

        let dirs = xdg::parse_user_dirs(TEST_USERDIRS.as_bytes(), Path::new("/home/ferris"));

        assert_eq!(dirs.desktop(), Some("/home/ferris/Desktop".as_ref()));
        assert_eq!(dirs.downloads(), Some("/home/ferris/Downloads".as_ref()));
        assert_eq!(dirs.templates(), Some("/pub/Templates".as_ref()));
        assert_eq!(dirs.documents(), Some("/home/ferris/Documents".as_ref()));
        assert_eq!(dirs.music(), Some("/home/ferris/My \"Music\"".as_ref()));
        assert_eq!(dirs.pictures(), Some("/home/ferris/Pictures".as_ref()));
        assert_eq!(dirs.videos(), None);
    }

    #[test]
    fn test_ill_user_dirs_parsing() {
        const TEST_USERDIRS: &'static str = r#"
# unquoted
XDG_DESKTOP_DIR=$HOME/Desktop
# mixed quoting
XDG_DOWNLOAD_DIR="$HOME"/"Downloads"
# non-HOME env
XDG_TEMPLATES_DIR="/home/$USER/Templates"
# missing PUBLICSHARE
# command substitution
XDG_DOCUMENTS_DIR="`pwd`/Documents"
# non-symbolic homedir disabled
XDG_MUSIC_DIR="/home/ferris"
# set multiple times
XDG_PICTURES_DIR="$HOME/Pictures1"
XDG_PICTURES_DIR="$HOME/Pictures2"
# relative path
XDG_VIDEOS_DIR="Videos"
"#;

        let dirs = xdg::parse_user_dirs(TEST_USERDIRS.as_bytes(), Path::new("/home/ferris"));

        assert_eq!(dirs.desktop(), None);
        assert_eq!(dirs.downloads(), None);
        assert_eq!(dirs.templates(), None);
        assert_eq!(dirs.documents(), None);
        assert_eq!(dirs.music(), None);
        assert_eq!(dirs.pictures(), Some("/home/ferris/Pictures2".as_ref()));
        assert_eq!(dirs.videos(), None);
    }
}
