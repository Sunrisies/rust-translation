//! 跨平台路径操作。
//!
//! This module provides two types, [`PathBuf`] and [`Path`] (akin to [`String`]
//! and [`str`]), for working with paths abstractly. These types are thin wrappers
//! around [`OsString`] and [`OsStr`] respectively, meaning that they work directly
//! 根据本地平台的路径语法，这些类型可以处理字符串。
//!
//! Paths can be parsed into [`Component`]s by iterating over the structure
//! returned by the [`components`] method on [`Path`]. [`Component`]s roughly
//! correspond to the substrings between path separators (`/` or `\`). You can
//! reconstruct an equivalent path from components with the [`push`] method on
//! [`PathBuf`]; note that the paths may differ syntactically by the
//! normalization described in the documentation for the [`components`] method.
//!
//! ## 与平台或文件系统无关。不过，Windows 下的磁盘驱动器字母除外。
//!
//! ## 路径规范化
//! such as [`Path::starts_with`] and [`Path::ends_with`], are case sensitive no
//! matter the platform or filesystem. An exception to this is made for Windows
//! drive letters.
//!
//! ## Path normalization
//!
//! Several methods in this module perform basic path normalization by disregarding
//! repeated separators, non-leading `.` components, and trailing separators. These include:
//! - Methods for iteration, such as [`Path::components`] and [`Path::iter`]
//! - Methods for inspection, such as [`Path::has_root`]
//! - Comparisons using [`PartialEq`], [`PartialOrd`], and [`Ord`]
//!
//! [`Path::join`] and [`PathBuf::push`] also disregard trailing slashes.
//!
// FIXME(normalize_lexically): mention normalize_lexically once stable
//! These methods **do not** resolve `..` components or symlinks. For full normalization
//! including `..` resolution, use [`Path::canonicalize`] (which does access the filesystem).
//!
//! ## Simple usage
//!
//! Path manipulation includes both parsing components from slices and building
//! new owned paths.
//!
//! To parse a path, you can create a [`Path`] slice from a [`str`]
//! slice and start asking questions:
//!
//! ```
//! use std::path::Path;
//! use std::ffi::OsStr;
//!
//! let path = Path::new("/tmp/foo/bar.txt");
//!
//! let parent = path.parent();
//! assert_eq!(parent, Some(Path::new("/tmp/foo")));
//!
//! let file_stem = path.file_stem();
//! assert_eq!(file_stem, Some(OsStr::new("bar")));
//!
//! let extension = path.extension();
//! assert_eq!(extension, Some(OsStr::new("txt")));
//! ```
//!
//! To build or modify paths, use [`PathBuf`]:
//!
//! ```
//! use std::path::PathBuf;
//!
//! // This way works...
//! let mut path = PathBuf::from("c:\\");
//!
//! path.push("windows");
//! path.push("system32");
//!
//! path.set_extension("dll");
//!
//! // ... but push is best used if you don't know everything up
//! // front. If you do, this way is better:
//! let path: PathBuf = ["c:\\", "windows", "system32.dll"].iter().collect();
//! ```
//!
//! [`components`]: Path::components
//! [`push`]: PathBuf::push

#![stable(feature = "rust1", since = "1.0.0")]
#![deny(unsafe_op_in_unsafe_fn)]

use core::clone::CloneToUninit;

use crate::alloc::Allocator;
use crate::borrow::{Borrow, Cow};
use crate::collections::TryReserveError;
use crate::error::Error;
use crate::ffi::{OsStr, OsString, os_str};
use crate::hash::{Hash, Hasher};
use crate::iter::FusedIterator;
use crate::ops::{self, Deref};
use crate::rc::Rc;
use crate::str::FromStr;
use crate::sync::Arc;
use crate::sys::path::{HAS_PREFIXES, is_sep_byte, is_verbatim_sep, parse_prefix};
use crate::{cmp, fmt, fs, io, sys};

////////////////////////////////////////////////////////////////////////////////
// GENERAL NOTES
////////////////////////////////////////////////////////////////////////////////
//
// Parsing in this module is done by directly transmuting OsStr to [u8] slices,
// taking advantage of the fact that OsStr always encodes ASCII characters
// as-is.  Eventually, this transmutation should be replaced by direct uses of
// OsStr APIs for parsing, but it will take a while for those to become
// available.

////////////////////////////////////////////////////////////////////////////////
// Windows Prefixes
////////////////////////////////////////////////////////////////////////////////

/// Windows path prefixes, e.g., `C:` or `\\server\share`.
///
/// Windows uses a variety of path prefix styles, including references to drive
/// volumes (like `C:`), network shared folders (like `\\server\share`), and
/// others. In addition, some path prefixes are "verbatim" (i.e., prefixed with
/// `\\?\`), in which case `/` is *not* treated as a separator and essentially
/// no normalization is performed.
///
/// # 示例
///
/// ```
/// use std::path::{Component, Path, Prefix};
/// use std::path::Prefix::*;
/// use std::ffi::OsStr;
///
/// fn get_path_prefix(s: &str) -> Prefix<'_> {
///     let path = Path::new(s);
///     match path.components().next().unwrap() {
///         Component::Prefix(prefix_component) => prefix_component.kind(),
///         _ => panic!(),
///     }
/// }
///
/// # if cfg!(windows) {
/// assert_eq!(Verbatim(OsStr::new("pictures")),
///            get_path_prefix(r"\\?\pictures\kittens"));
/// assert_eq!(VerbatimUNC(OsStr::new("server"), OsStr::new("share")),
///            get_path_prefix(r"\\?\UNC\server\share"));
/// assert_eq!(VerbatimDisk(b'C'), get_path_prefix(r"\\?\c:\"));
/// assert_eq!(DeviceNS(OsStr::new("BrainInterface")),
///            get_path_prefix(r"\\.\BrainInterface"));
/// assert_eq!(UNC(OsStr::new("server"), OsStr::new("share")),
///            get_path_prefix(r"\\server\share"));
/// assert_eq!(Disk(b'C'), get_path_prefix(r"C:\Users\Rust\Pictures\Ferris"));
/// # }
/// ```
#[derive(Copy, Clone, Debug, Hash, PartialOrd, Ord, PartialEq, Eq)]
#[stable(feature = "rust1", since = "1.0.0")]
pub enum Prefix<'a> {
    /// Verbatim prefix, e.g., `\\?\cat_pics`.
    ///
    /// Verbatim prefixes consist of `\\?\` immediately followed by the given
    /// 组件。
    #[stable(feature = "rust1", since = "1.0.0")]
    Verbatim(#[stable(feature = "rust1", since = "1.0.0")] &'a OsStr),

    /// 使用 Windows 的 _**U**niform **N**aming **C**onvention_ 的直译前缀，
    /// e.g., `\\?\UNC\server\share`.
    ///
    /// Verbatim UNC prefixes consist of `\\?\UNC\` immediately followed by the
    /// server's hostname and a share name.
    #[stable(feature = "rust1", since = "1.0.0")]
    VerbatimUNC(
        #[stable(feature = "rust1", since = "1.0.0")] &'a OsStr,
        #[stable(feature = "rust1", since = "1.0.0")] &'a OsStr,
    ),

    /// Verbatim disk prefix, e.g., `\\?\C:`.
    ///
    /// Verbatim disk prefixes consist of `\\?\` immediately followed by the
    /// drive letter and `:`.
    #[stable(feature = "rust1", since = "1.0.0")]
    VerbatimDisk(#[stable(feature = "rust1", since = "1.0.0")] u8),

    /// Device namespace prefix, e.g., `\\.\COM42`.
    ///
    /// Device namespace prefixes consist of `\\.\` (possibly using `/`
    /// instead of `\`), immediately followed by the device name.
    #[stable(feature = "rust1", since = "1.0.0")]
    DeviceNS(#[stable(feature = "rust1", since = "1.0.0")] &'a OsStr),

    /// 使用 Windows 的 _**U**niform **N**aming **C**onvention_ 的前缀，例如
    /// `\\server\share`.
    ///
    /// UNC 前缀由服务器主机名和共享名组成。
    #[stable(feature = "rust1", since = "1.0.0")]
    UNC(
        #[stable(feature = "rust1", since = "1.0.0")] &'a OsStr,
        #[stable(feature = "rust1", since = "1.0.0")] &'a OsStr,
    ),

    /// Prefix `C:` for the given disk drive.
    #[stable(feature = "rust1", since = "1.0.0")]
    Disk(#[stable(feature = "rust1", since = "1.0.0")] u8),
}

impl<'a> Prefix<'a> {
    #[inline]
    fn len(&self) -> usize {
        use self::Prefix::*;
        fn os_str_len(s: &OsStr) -> usize {
            s.as_encoded_bytes().len()
        }
        match *self {
            Verbatim(x) => 4 + os_str_len(x),
            VerbatimUNC(x, y) => {
                8 + os_str_len(x) + if os_str_len(y) > 0 { 1 + os_str_len(y) } else { 0 }
            }
            VerbatimDisk(_) => 6,
            UNC(x, y) => 2 + os_str_len(x) + if os_str_len(y) > 0 { 1 + os_str_len(y) } else { 0 },
            DeviceNS(x) => 4 + os_str_len(x),
            Disk(_) => 2,
        }
    }

    /// Determines if the prefix is verbatim, i.e., begins with `\\?\`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::Prefix::*;
    /// use std::ffi::OsStr;
    ///
    /// assert!(Verbatim(OsStr::new("pictures")).is_verbatim());
    /// assert!(VerbatimUNC(OsStr::new("server"), OsStr::new("share")).is_verbatim());
    /// assert!(VerbatimDisk(b'C').is_verbatim());
    /// assert!(!DeviceNS(OsStr::new("BrainInterface")).is_verbatim());
    /// assert!(!UNC(OsStr::new("server"), OsStr::new("share")).is_verbatim());
    /// assert!(!Disk(b'C').is_verbatim());
    /// ```
    #[inline]
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn is_verbatim(&self) -> bool {
        use self::Prefix::*;
        matches!(*self, Verbatim(_) | VerbatimDisk(_) | VerbatimUNC(..))
    }

    #[inline]
    fn is_drive(&self) -> bool {
        matches!(*self, Prefix::Disk(_))
    }

    #[inline]
    fn has_implicit_root(&self) -> bool {
        !self.is_drive()
    }
}

////////////////////////////////////////////////////////////////////////////////
// Exposed parsing helpers
////////////////////////////////////////////////////////////////////////////////

/// 确定字符是否为当前平台允许的路径分隔符之一。
/// 当前平台的路径分隔符。
///
/// # 示例
///
/// ```
/// use std::path;
///
/// assert!(path::is_separator('/')); // '/' works for both Unix and Windows
/// assert!(!path::is_separator('❤'));
/// ```
#[must_use]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_path_separators", issue = "153106")]
pub const fn is_separator(c: char) -> bool {
    c.is_ascii() && is_sep_byte(c as u8)
}

/// All path separators recognized on the current platform, represented as [`char`]s; for example,
/// this is `&['/'][..]` on Unix and `&['\\', '/'][..]` on Windows. The [primary
/// separator](MAIN_SEPARATOR) is always element 0 of the slice.
#[unstable(feature = "const_path_separators", issue = "153106")]
pub const SEPARATORS: &[char] = crate::sys::path::SEPARATORS;

/// All path separators recognized on the current platform, represented as [`&str`]s; for example,
/// this is `&["/"][..]` on Unix and `&["\\", "/"][..]` on Windows. The [primary
/// separator](MAIN_SEPARATOR_STR) is always element 0 of the slice.
#[unstable(feature = "const_path_separators", issue = "153106")]
pub const SEPARATORS_STR: &[&str] = crate::sys::path::SEPARATORS_STR;

/// The primary separator of path components for the current platform, represented as a [`char`];
/// for example, this is `'/'` on Unix and `'\\'` on Windows.
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "path_main_separator")]
pub const MAIN_SEPARATOR: char = SEPARATORS[0];

/// The primary separator of path components for the current platform, represented as a [`&str`];
/// for example, this is `"/"` on Unix and `"\\"` on Windows.
#[stable(feature = "main_separator_str", since = "1.68.0")]
pub const MAIN_SEPARATOR_STR: &str = SEPARATORS_STR[0];

////////////////////////////////////////////////////////////////////////////////
// Misc helpers
////////////////////////////////////////////////////////////////////////////////

// Iterate through `iter` while it matches `prefix`; return `None` if `prefix`
// is not a prefix of `iter`, otherwise return `Some(iter_after_prefix)` giving
// `iter` after having exhausted `prefix`.
fn iter_after<'a, 'b, I, J>(mut iter: I, mut prefix: J) -> Option<I>
where
    I: Iterator<Item = Component<'a>> + Clone,
    J: Iterator<Item = Component<'b>>,
{
    loop {
        let mut iter_next = iter.clone();
        match (iter_next.next(), prefix.next()) {
            (Some(ref x), Some(ref y)) if x == y => (),
            (Some(_), Some(_)) => return None,
            (Some(_), None) => return Some(iter),
            (None, None) => return Some(iter),
            (None, Some(_)) => return None,
        }
        iter = iter_next;
    }
}

////////////////////////////////////////////////////////////////////////////////
// Cross-platform, iterator-independent parsing
////////////////////////////////////////////////////////////////////////////////

/// 指示前缀后的第一个字节是否为分隔符。
fn has_physical_root(s: &[u8], prefix: Option<Prefix<'_>>) -> bool {
    let path = if let Some(p) = prefix { &s[p.len()..] } else { s };
    !path.is_empty() && is_sep_byte(path[0])
}

// basic workhorse for splitting stem and extension
fn rsplit_file_at_dot(file: &OsStr) -> (Option<&OsStr>, Option<&OsStr>) {
    if file.as_encoded_bytes() == b".." {
        return (Some(file), None);
    }

    // The unsafety here stems from converting between &OsStr and &[u8]
    // and back. This is safe to do because (1) we only look at ASCII
    // contents of the encoding and (2) new &OsStr values are produced
    // only from ASCII-bounded slices of existing &OsStr values.
    let mut iter = file.as_encoded_bytes().rsplitn(2, |b| *b == b'.');
    let after = iter.next();
    let before = iter.next();
    if before == Some(b"") {
        (Some(file), None)
    } else {
        unsafe {
            (
                before.map(|s| OsStr::from_encoded_bytes_unchecked(s)),
                after.map(|s| OsStr::from_encoded_bytes_unchecked(s)),
            )
        }
    }
}

fn split_file_at_dot(file: &OsStr) -> (&OsStr, Option<&OsStr>) {
    let slice = file.as_encoded_bytes();
    if slice == b".." {
        return (file, None);
    }

    // The unsafety here stems from converting between &OsStr and &[u8]
    // and back. This is safe to do because (1) we only look at ASCII
    // contents of the encoding and (2) new &OsStr values are produced
    // only from ASCII-bounded slices of existing &OsStr values.
    let i = match slice[1..].iter().position(|b| *b == b'.') {
        Some(i) => i + 1,
        None => return (file, None),
    };
    let before = &slice[..i];
    let after = &slice[i + 1..];
    unsafe {
        (
            OsStr::from_encoded_bytes_unchecked(before),
            Some(OsStr::from_encoded_bytes_unchecked(after)),
        )
    }
}

/// 检查字符串是否作为文件扩展名有效，否则触发 panic。
fn validate_extension(extension: &OsStr) {
    for &b in extension.as_encoded_bytes() {
        if is_sep_byte(b) {
            panic!("extension cannot contain path separators: {extension:?}");
        }
    }
}

////////////////////////////////////////////////////////////////////////////////
// The core iterators
////////////////////////////////////////////////////////////////////////////////

/// 组件解析通过双向状态机实现；光标在
/// 路径的起始和末尾分别跟踪已消耗的路径部分。
/// 到目前为止已消耗的路径部分。
///
/// 从前往后，路径由前缀、起始
/// 目录组件和主体（正常组件）组成。
#[derive(Copy, Clone, PartialEq, PartialOrd, Debug)]
enum State {
    Prefix = 0,   // c:
    StartDir = 1, // / or . or nothing
    Body = 2,     // foo/bar/baz
    Done = 3,
}

/// 包装 Windows 路径前缀及其未解析字符串的结构。
/// 表示形式。
///
/// In addition to the parsed [`Prefix`] information returned by [`kind`],
/// `PrefixComponent` also holds the raw and unparsed [`OsStr`] slice,
/// returned by [`as_os_str`].
///
/// Instances of this `struct` can be obtained by matching against the
/// [`Prefix` variant] on [`Component`].
///
/// 在 Unix 系统上不会出现。
///
/// # 示例
///
/// ```
/// # if cfg!(windows) {
/// use std::path::{Component, Path, Prefix};
/// use std::ffi::OsStr;
///
/// let path = Path::new(r"c:\you\later\");
/// match path.components().next().unwrap() {
///     Component::Prefix(prefix_component) => {
///         assert_eq!(Prefix::Disk(b'C'), prefix_component.kind());
///         assert_eq!(OsStr::new("c:"), prefix_component.as_os_str());
///     }
///     _ => unreachable!(),
/// }
/// # }
/// ```
///
/// [`as_os_str`]: PrefixComponent::as_os_str
/// [`kind`]: PrefixComponent::kind
/// [`Prefix` variant]: Component::Prefix
#[stable(feature = "rust1", since = "1.0.0")]
#[derive(Copy, Clone, Eq, Debug)]
pub struct PrefixComponent<'a> {
    /// The prefix as an unparsed `OsStr` slice.
    raw: &'a OsStr,

    /// 已解析的前缀数据。
    parsed: Prefix<'a>,
}

impl<'a> PrefixComponent<'a> {
    /// 返回已解析的前缀数据。
    ///
    /// See [`Prefix`]'s documentation for more information on the different
    /// 存在多种前缀类型。
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    #[inline]
    pub fn kind(&self) -> Prefix<'a> {
        self.parsed
    }

    /// Returns the raw [`OsStr`] slice for this prefix.
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    #[inline]
    pub fn as_os_str(&self) -> &'a OsStr {
        self.raw
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<'a> PartialEq for PrefixComponent<'a> {
    #[inline]
    fn eq(&self, other: &PrefixComponent<'a>) -> bool {
        self.parsed == other.parsed
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<'a> PartialOrd for PrefixComponent<'a> {
    #[inline]
    fn partial_cmp(&self, other: &PrefixComponent<'a>) -> Option<cmp::Ordering> {
        PartialOrd::partial_cmp(&self.parsed, &other.parsed)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Ord for PrefixComponent<'_> {
    #[inline]
    fn cmp(&self, other: &Self) -> cmp::Ordering {
        Ord::cmp(&self.parsed, &other.parsed)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Hash for PrefixComponent<'_> {
    fn hash<H: Hasher>(&self, h: &mut H) {
        self.parsed.hash(h);
    }
}

/// 路径中的一个单独组件。
///
/// A `Component` roughly corresponds to a substring between path separators
/// (`/` or `\`).
///
/// This `enum` is created by iterating over [`Components`], which in turn is
/// created by the [`components`](Path::components) method on [`Path`].
///
/// # Examples
///
/// ```rust
/// use std::path::{Component, Path};
///
/// let path = Path::new("/tmp/foo/bar.txt");
/// let components = path.components().collect::<Vec<_>>();
/// assert_eq!(&components, &[
///     Component::RootDir,
///     Component::Normal("tmp".as_ref()),
///     Component::Normal("foo".as_ref()),
///     Component::Normal("bar.txt".as_ref()),
/// ]);
/// ```
#[derive(Copy, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Debug)]
#[stable(feature = "rust1", since = "1.0.0")]
pub enum Component<'a> {
    /// A Windows path prefix, e.g., `C:` or `\\server\share`.
    ///
    /// There is a large variety of prefix types, see [`Prefix`]'s documentation
    /// 在 Unix 系统上不会出现。
    ///
    /// 根目录组件，出现在任何前缀之后、其他内容之前。
    #[stable(feature = "rust1", since = "1.0.0")]
    Prefix(#[stable(feature = "rust1", since = "1.0.0")] PrefixComponent<'a>),

    /// 它代表一个分隔符，表明路径从根开始。
    ///
    /// It represents a separator that designates that a path starts from root.
    #[stable(feature = "rust1", since = "1.0.0")]
    RootDir,

    /// A reference to the current directory, i.e., `.`.
    #[stable(feature = "rust1", since = "1.0.0")]
    CurDir,

    /// A reference to the parent directory, i.e., `..`.
    #[stable(feature = "rust1", since = "1.0.0")]
    ParentDir,

    /// A normal component, e.g., `a` and `b` in `a/b`.
    ///
    /// 这种变体是最常见的，它代表对文件的引用。
    /// 或对目录的引用。
    #[stable(feature = "rust1", since = "1.0.0")]
    Normal(#[stable(feature = "rust1", since = "1.0.0")] &'a OsStr),
}

impl<'a> Component<'a> {
    /// Extracts the underlying [`OsStr`] slice.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::Path;
    ///
    /// let path = Path::new("./tmp/foo/bar.txt");
    /// let components: Vec<_> = path.components().map(|comp| comp.as_os_str()).collect();
    /// assert_eq!(&components, &[".", "tmp", "foo", "bar.txt"]);
    /// ```
    #[must_use = "`self` will be dropped if the result is not used"]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn as_os_str(self) -> &'a OsStr {
        match self {
            Component::Prefix(p) => p.as_os_str(),
            Component::RootDir => OsStr::new(MAIN_SEPARATOR_STR),
            Component::CurDir => OsStr::new("."),
            Component::ParentDir => OsStr::new(".."),
            Component::Normal(path) => path,
        }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl AsRef<OsStr> for Component<'_> {
    #[inline]
    fn as_ref(&self) -> &OsStr {
        self.as_os_str()
    }
}

#[stable(feature = "path_component_asref", since = "1.25.0")]
impl AsRef<Path> for Component<'_> {
    #[inline]
    fn as_ref(&self) -> &Path {
        self.as_os_str().as_ref()
    }
}

/// An iterator over the [`Component`]s of a [`Path`].
///
/// This `struct` is created by the [`components`] method on [`Path`].
/// 有关更多信息，请参阅其文档。
///
/// # 示例
///
/// ```
/// use std::path::Path;
///
/// let path = Path::new("/tmp/foo/bar.txt");
///
/// for component in path.components() {
///     println!("{component:?}");
/// }
/// ```
///
/// [`components`]: Path::components
#[derive(Clone)]
#[must_use = "iterators are lazy and do nothing unless consumed"]
#[stable(feature = "rust1", since = "1.0.0")]
pub struct Components<'a> {
    // The path left to parse components from
    path: &'a [u8],

    // The prefix as it was originally parsed, if any
    prefix: Option<Prefix<'a>>,

    // true if path *physically* has a root separator; for most Windows
    // prefixes, it may have a "logical" root separator for the purposes of
    // normalization, e.g., \\server\share == \\server\share\.
    has_physical_root: bool,

    // The iterator is double-ended, and these two states keep track of what has
    // been produced from either end
    front: State,
    back: State,
}

/// An iterator over the [`Component`]s of a [`Path`], as [`OsStr`] slices.
///
/// This `struct` is created by the [`iter`] method on [`Path`].
/// 有关更多信息，请参阅其文档。
///
/// [`iter`]: Path::iter
#[derive(Clone)]
#[must_use = "iterators are lazy and do nothing unless consumed"]
#[stable(feature = "rust1", since = "1.0.0")]
pub struct Iter<'a> {
    inner: Components<'a>,
}

#[stable(feature = "path_components_debug", since = "1.13.0")]
impl fmt::Debug for Components<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        struct DebugHelper<'a>(&'a Path);

        impl fmt::Debug for DebugHelper<'_> {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                f.debug_list().entries(self.0.components()).finish()
            }
        }

        f.debug_tuple("Components").field(&DebugHelper(self.as_path())).finish()
    }
}

impl<'a> Components<'a> {
    // how long is the prefix, if any?
    #[inline]
    fn prefix_len(&self) -> usize {
        if !HAS_PREFIXES {
            return 0;
        }
        self.prefix.as_ref().map(Prefix::len).unwrap_or(0)
    }

    #[inline]
    fn prefix_verbatim(&self) -> bool {
        if !HAS_PREFIXES {
            return false;
        }
        self.prefix.as_ref().map(Prefix::is_verbatim).unwrap_or(false)
    }

    /// 从迭代的角度来看，剩余的前缀部分有多少？
    #[inline]
    fn prefix_remaining(&self) -> usize {
        if !HAS_PREFIXES {
            return 0;
        }
        if self.front == State::Prefix { self.prefix_len() } else { 0 }
    }

    // Given the iteration so far, how much of the pre-State::Body path is left?
    #[inline]
    fn len_before_body(&self) -> usize {
        let root = if self.front <= State::StartDir && self.has_physical_root { 1 } else { 0 };
        let cur_dir = if self.front <= State::StartDir && self.include_cur_dir() { 1 } else { 0 };
        self.prefix_remaining() + root + cur_dir
    }

    // is the iteration complete?
    #[inline]
    fn finished(&self) -> bool {
        self.front == State::Done || self.back == State::Done || self.front > self.back
    }

    #[inline]
    fn is_sep_byte(&self, b: u8) -> bool {
        if self.prefix_verbatim() { is_verbatim_sep(b) } else { is_sep_byte(b) }
    }

    /// 提取用于迭代的剩余路径部分的切片。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::Path;
    ///
    /// let mut components = Path::new("/tmp/foo/bar.txt").components();
    /// components.next();
    /// components.next();
    ///
    /// assert_eq!(Path::new("foo/bar.txt"), components.as_path());
    /// ```
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn as_path(&self) -> &'a Path {
        let mut comps = self.clone();
        if comps.front == State::Body {
            comps.trim_left();
        }
        if comps.back == State::Body {
            comps.trim_right();
        }
        unsafe { Path::from_u8_slice(comps.path) }
    }

    /// *原始* 路径是以根为起点的吗？
    fn has_root(&self) -> bool {
        if self.has_physical_root {
            return true;
        }
        if HAS_PREFIXES && let Some(p) = self.prefix {
            if p.has_implicit_root() {
                return true;
            }
        }
        false
    }

    /// 规范化后的路径是否应包含开头的 .？
    fn include_cur_dir(&self) -> bool {
        if self.has_root() {
            return false;
        }
        let slice = &self.path[self.prefix_remaining()..];
        match slice {
            [b'.'] => true,
            [b'.', b, ..] => self.is_sep_byte(*b),
            _ => false,
        }
    }

    // parse a given byte sequence following the OsStr encoding into the
    // corresponding path component
    unsafe fn parse_single_component<'b>(&self, comp: &'b [u8]) -> Option<Component<'b>> {
        match comp {
            b"." if HAS_PREFIXES && self.prefix_verbatim() => Some(Component::CurDir),
            b"." => None, // . components are normalized away, except at
            // the beginning of a path, which is treated
            // separately via `include_cur_dir`
            b".." => Some(Component::ParentDir),
            b"" => None,
            _ => Some(Component::Normal(unsafe { OsStr::from_encoded_bytes_unchecked(comp) })),
        }
    }

    // parse a component from the left, saying how many bytes to consume to
    // remove the component
    fn parse_next_component(&self) -> (usize, Option<Component<'a>>) {
        debug_assert!(self.front == State::Body);
        let (extra, comp) = match self.path.iter().position(|b| self.is_sep_byte(*b)) {
            None => (0, self.path),
            Some(i) => (1, &self.path[..i]),
        };
        // SAFETY: `comp` is a valid substring, since it is split on a separator.
        (comp.len() + extra, unsafe { self.parse_single_component(comp) })
    }

    // parse a component from the right, saying how many bytes to consume to
    // remove the component
    fn parse_next_component_back(&self) -> (usize, Option<Component<'a>>) {
        debug_assert!(self.back == State::Body);
        let start = self.len_before_body();
        let (extra, comp) = match self.path[start..].iter().rposition(|b| self.is_sep_byte(*b)) {
            None => (0, &self.path[start..]),
            Some(i) => (1, &self.path[start + i + 1..]),
        };
        // SAFETY: `comp` is a valid substring, since it is split on a separator.
        (comp.len() + extra, unsafe { self.parse_single_component(comp) })
    }

    // trim away repeated separators (i.e., empty components) on the left
    fn trim_left(&mut self) {
        while !self.path.is_empty() {
            let (size, comp) = self.parse_next_component();
            if comp.is_some() {
                return;
            } else {
                self.path = &self.path[size..];
            }
        }
    }

    // trim away repeated separators (i.e., empty components) on the right
    fn trim_right(&mut self) {
        while self.path.len() > self.len_before_body() {
            let (size, comp) = self.parse_next_component_back();
            if comp.is_some() {
                return;
            } else {
                self.path = &self.path[..self.path.len() - size];
            }
        }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl AsRef<Path> for Components<'_> {
    #[inline]
    fn as_ref(&self) -> &Path {
        self.as_path()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl AsRef<OsStr> for Components<'_> {
    #[inline]
    fn as_ref(&self) -> &OsStr {
        self.as_path().as_os_str()
    }
}

#[stable(feature = "path_iter_debug", since = "1.13.0")]
impl fmt::Debug for Iter<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        struct DebugHelper<'a>(&'a Path);

        impl fmt::Debug for DebugHelper<'_> {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                f.debug_list().entries(self.0.iter()).finish()
            }
        }

        f.debug_tuple("Iter").field(&DebugHelper(self.as_path())).finish()
    }
}

impl<'a> Iter<'a> {
    /// 提取用于迭代的剩余路径部分的切片。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::Path;
    ///
    /// let mut iter = Path::new("/tmp/foo/bar.txt").iter();
    /// iter.next();
    /// iter.next();
    ///
    /// assert_eq!(Path::new("foo/bar.txt"), iter.as_path());
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    #[inline]
    pub fn as_path(&self) -> &'a Path {
        self.inner.as_path()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl AsRef<Path> for Iter<'_> {
    #[inline]
    fn as_ref(&self) -> &Path {
        self.as_path()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl AsRef<OsStr> for Iter<'_> {
    #[inline]
    fn as_ref(&self) -> &OsStr {
        self.as_path().as_os_str()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<'a> Iterator for Iter<'a> {
    type Item = &'a OsStr;

    #[inline]
    fn next(&mut self) -> Option<&'a OsStr> {
        self.inner.next().map(Component::as_os_str)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<'a> DoubleEndedIterator for Iter<'a> {
    #[inline]
    fn next_back(&mut self) -> Option<&'a OsStr> {
        self.inner.next_back().map(Component::as_os_str)
    }
}

#[stable(feature = "fused", since = "1.26.0")]
impl FusedIterator for Iter<'_> {}

#[stable(feature = "rust1", since = "1.0.0")]
impl<'a> Iterator for Components<'a> {
    type Item = Component<'a>;

    fn next(&mut self) -> Option<Component<'a>> {
        while !self.finished() {
            match self.front {
                // most likely case first
                State::Body if !self.path.is_empty() => {
                    let (size, comp) = self.parse_next_component();
                    self.path = &self.path[size..];
                    if comp.is_some() {
                        return comp;
                    }
                }
                State::Body => {
                    self.front = State::Done;
                }
                State::StartDir => {
                    self.front = State::Body;
                    if self.has_physical_root {
                        debug_assert!(!self.path.is_empty());
                        self.path = &self.path[1..];
                        return Some(Component::RootDir);
                    } else if HAS_PREFIXES && let Some(p) = self.prefix {
                        if p.has_implicit_root() && !p.is_verbatim() {
                            return Some(Component::RootDir);
                        }
                    } else if self.include_cur_dir() {
                        debug_assert!(!self.path.is_empty());
                        self.path = &self.path[1..];
                        return Some(Component::CurDir);
                    }
                }
                _ if const { !HAS_PREFIXES } => unreachable!(),
                State::Prefix if self.prefix_len() == 0 => {
                    self.front = State::StartDir;
                }
                State::Prefix => {
                    self.front = State::StartDir;
                    debug_assert!(self.prefix_len() <= self.path.len());
                    let raw = &self.path[..self.prefix_len()];
                    self.path = &self.path[self.prefix_len()..];
                    return Some(Component::Prefix(PrefixComponent {
                        raw: unsafe { OsStr::from_encoded_bytes_unchecked(raw) },
                        parsed: self.prefix.unwrap(),
                    }));
                }
                State::Done => unreachable!(),
            }
        }
        None
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<'a> DoubleEndedIterator for Components<'a> {
    fn next_back(&mut self) -> Option<Component<'a>> {
        while !self.finished() {
            match self.back {
                State::Body if self.path.len() > self.len_before_body() => {
                    let (size, comp) = self.parse_next_component_back();
                    self.path = &self.path[..self.path.len() - size];
                    if comp.is_some() {
                        return comp;
                    }
                }
                State::Body => {
                    self.back = State::StartDir;
                }
                State::StartDir => {
                    self.back = if HAS_PREFIXES { State::Prefix } else { State::Done };
                    if self.has_physical_root {
                        self.path = &self.path[..self.path.len() - 1];
                        return Some(Component::RootDir);
                    } else if HAS_PREFIXES && let Some(p) = self.prefix {
                        if p.has_implicit_root() && !p.is_verbatim() {
                            return Some(Component::RootDir);
                        }
                    } else if self.include_cur_dir() {
                        self.path = &self.path[..self.path.len() - 1];
                        return Some(Component::CurDir);
                    }
                }
                _ if !HAS_PREFIXES => unreachable!(),
                State::Prefix if self.prefix_len() > 0 => {
                    self.back = State::Done;
                    return Some(Component::Prefix(PrefixComponent {
                        raw: unsafe { OsStr::from_encoded_bytes_unchecked(self.path) },
                        parsed: self.prefix.unwrap(),
                    }));
                }
                State::Prefix => {
                    self.back = State::Done;
                    return None;
                }
                State::Done => unreachable!(),
            }
        }
        None
    }
}

#[stable(feature = "fused", since = "1.26.0")]
impl FusedIterator for Components<'_> {}

#[stable(feature = "rust1", since = "1.0.0")]
impl<'a> PartialEq for Components<'a> {
    #[inline]
    fn eq(&self, other: &Components<'a>) -> bool {
        let Components { path: _, front: _, back: _, has_physical_root: _, prefix: _ } = self;

        // Fast path for exact matches, e.g. for hashmap lookups.
        // Don't explicitly compare the prefix or has_physical_root fields since they'll
        // either be covered by the `path` buffer or are only relevant for `prefix_verbatim()`.
        if self.path.len() == other.path.len()
            && self.front == other.front
            && self.back == State::Body
            && other.back == State::Body
            && self.prefix_verbatim() == other.prefix_verbatim()
        {
            // possible future improvement: this could bail out earlier if there were a
            // reverse memcmp/bcmp comparing back to front
            if self.path == other.path {
                return true;
            }
        }

        // compare back to front since absolute paths often share long prefixes
        Iterator::eq(self.clone().rev(), other.clone().rev())
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Eq for Components<'_> {}

#[stable(feature = "rust1", since = "1.0.0")]
impl<'a> PartialOrd for Components<'a> {
    #[inline]
    fn partial_cmp(&self, other: &Components<'a>) -> Option<cmp::Ordering> {
        Some(compare_components(self.clone(), other.clone()))
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Ord for Components<'_> {
    #[inline]
    fn cmp(&self, other: &Self) -> cmp::Ordering {
        compare_components(self.clone(), other.clone())
    }
}

fn compare_components(mut left: Components<'_>, mut right: Components<'_>) -> cmp::Ordering {
    // Fast path for long shared prefixes
    //
    // - compare raw bytes to find first mismatch
    // - backtrack to find separator before mismatch to avoid ambiguous parsings of '.' or '..' characters
    // - if found update state to only do a component-wise comparison on the remainder,
    //   otherwise do it on the full path
    //
    // The fast path isn't taken for paths with a PrefixComponent to avoid backtracking into
    // the middle of one
    if left.prefix.is_none() && right.prefix.is_none() && left.front == right.front {
        // possible future improvement: a [u8]::first_mismatch simd implementation
        let first_difference = match left.path.iter().zip(right.path).position(|(&a, &b)| a != b) {
            None if left.path.len() == right.path.len() => return cmp::Ordering::Equal,
            None => left.path.len().min(right.path.len()),
            Some(diff) => diff,
        };

        if let Some(previous_sep) =
            left.path[..first_difference].iter().rposition(|&b| left.is_sep_byte(b))
        {
            let mismatched_component_start = previous_sep + 1;
            left.path = &left.path[mismatched_component_start..];
            left.front = State::Body;
            right.path = &right.path[mismatched_component_start..];
            right.front = State::Body;
        }
    }

    Iterator::cmp(left, right)
}

/// An iterator over [`Path`] and its ancestors.
///
/// This `struct` is created by the [`ancestors`] method on [`Path`].
/// 有关更多信息，请参阅其文档。
///
/// # 示例
///
/// ```
/// use std::path::Path;
///
/// let path = Path::new("/foo/bar");
///
/// for ancestor in path.ancestors() {
///     println!("{}", ancestor.display());
/// }
/// ```
///
/// [`ancestors`]: Path::ancestors
#[derive(Copy, Clone, Debug)]
#[must_use = "iterators are lazy and do nothing unless consumed"]
#[stable(feature = "path_ancestors", since = "1.28.0")]
pub struct Ancestors<'a> {
    next: Option<&'a Path>,
}

#[stable(feature = "path_ancestors", since = "1.28.0")]
impl<'a> Iterator for Ancestors<'a> {
    type Item = &'a Path;

    #[inline]
    fn next(&mut self) -> Option<Self::Item> {
        let next = self.next;
        self.next = next.and_then(Path::parent);
        next
    }
}

#[stable(feature = "path_ancestors", since = "1.28.0")]
impl FusedIterator for Ancestors<'_> {}

////////////////////////////////////////////////////////////////////////////////
// Basic types and traits
////////////////////////////////////////////////////////////////////////////////

/// An owned, mutable path (akin to [`String`]).
///
/// This type provides methods like [`push`] and [`set_extension`] that mutate
/// the path in place. It also implements [`Deref`] to [`Path`], meaning that
/// all methods on [`Path`] slices are available on `PathBuf` values as well.
///
/// [`push`]: PathBuf::push
/// [`set_extension`]: PathBuf::set_extension
///
/// 关于整体方法的更多细节可以在
/// the [module documentation](self).
///
/// # 示例
///
/// You can use [`push`] to build up a `PathBuf` from
/// 组件：
///
/// ```
/// use std::path::PathBuf;
///
/// let mut path = PathBuf::new();
///
/// path.push(r"C:\");
/// path.push("windows");
/// path.push("system32");
///
/// path.set_extension("dll");
/// ```
///
/// However, [`push`] is best used for dynamic situations. This is a better way
/// 这样做：
///
/// ```
/// use std::path::PathBuf;
///
/// let path: PathBuf = [r"C:\", "windows", "system32.dll"].iter().collect();
/// ```
///
/// 我们仍然可以做得更好！由于这些都是字符串，我们可以使用
/// `From::from`:
///
/// ```
/// use std::path::PathBuf;
///
/// let path = PathBuf::from(r"C:\windows\system32.dll");
/// ```
///
/// 哪种方法最合适取决于您所处的情境。
///
/// Note that `PathBuf` does not always sanitize arguments, for example
/// [`push`] allows paths built from strings which include separators:
///
/// ```
/// use std::path::PathBuf;
///
/// let mut path = PathBuf::new();
///
/// path.push(r"C:\");
/// path.push("windows");
/// path.push(r"..\otherdir");
/// path.push("system32");
/// ```
///
/// The behavior of `PathBuf` may be changed to a panic on such inputs
/// in the future. [`Extend::extend`] should be used to add multi-part paths.
#[cfg_attr(not(test), rustc_diagnostic_item = "PathBuf")]
#[stable(feature = "rust1", since = "1.0.0")]
pub struct PathBuf {
    inner: OsString,
}

impl PathBuf {
    /// Allocates an empty `PathBuf`.
    ///
    /// # Examples
    ///
    /// ```
    /// use std::path::PathBuf;
    ///
    /// let path = PathBuf::new();
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    #[inline]
    #[rustc_const_stable(feature = "const_pathbuf_osstring_new", since = "1.91.0")]
    pub const fn new() -> PathBuf {
        PathBuf { inner: OsString::new() }
    }

    /// Creates a new `PathBuf` with a given capacity used to create the
    /// internal [`OsString`]. See [`with_capacity`] defined on [`OsString`].
    ///
    /// # Examples
    ///
    /// ```
    /// use std::path::PathBuf;
    ///
    /// let mut path = PathBuf::with_capacity(10);
    /// let capacity = path.capacity();
    ///
    /// // This push is done without reallocating
    /// path.push(r"C:\");
    ///
    /// assert_eq!(capacity, path.capacity());
    /// ```
    ///
    /// [`with_capacity`]: OsString::with_capacity
    #[stable(feature = "path_buf_capacity", since = "1.44.0")]
    #[must_use]
    #[inline]
    pub fn with_capacity(capacity: usize) -> PathBuf {
        PathBuf { inner: OsString::with_capacity(capacity) }
    }

    /// Coerces to a [`Path`] slice.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::{Path, PathBuf};
    ///
    /// let p = PathBuf::from("/test");
    /// assert_eq!(Path::new("/test"), p.as_path());
    /// ```
    #[cfg_attr(not(test), rustc_diagnostic_item = "pathbuf_as_path")]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    #[inline]
    pub fn as_path(&self) -> &Path {
        self
    }

    /// Consumes and leaks the `PathBuf`, returning a mutable reference to the contents,
    /// `&'a mut Path`.
    ///
    /// 调用者可以自由选择返回的生命周期，包括 'static。
    /// 实际上，此函数非常适合用于在程序剩余生命周期内存在的数据，因为丢弃返回的引用会导致内存泄漏。
    /// the program's life, as dropping the returned reference will cause a memory leak.
    ///
    /// It does not reallocate or shrink the `PathBuf`, so the leaked allocation may include
    /// unused capacity that is not part of the returned slice. If you want to discard excess
    /// capacity, call [`into_boxed_path`], and then [`Box::leak`] instead.
    /// 不过，请记住，缩减容量可能导致重新分配和复制。
    ///
    /// [`into_boxed_path`]: Self::into_boxed_path
    #[stable(feature = "os_string_pathbuf_leak", since = "1.89.0")]
    #[inline]
    pub fn leak<'a>(self) -> &'a mut Path {
        Path::from_inner_mut(self.inner.leak())
    }

    /// Extends `self` with `path`.
    ///
    /// If `path` is absolute, it replaces the current path.
    ///
    /// 在 Windows 上：
    ///
    /// * if `path` has a root but no prefix (e.g., `\windows`), it
    ///   replaces everything except for the prefix (if any) of `self`.
    /// * if `path` has a prefix but no root, it replaces `self`.
    /// * if `self` has a verbatim prefix (e.g. `\\?\C:\windows`)
    ///   and `path` is not empty, the new path is normalized: all references
    ///   to `.` and `..` are removed.
    ///
    /// Consider using [`Path::join`] if you need a new `PathBuf` instead of
    /// using this function on a cloned `PathBuf`.
    ///
    /// # 示例
    ///
    /// 推送相对路径会扩展现有路径：
    ///
    /// ```
    /// use std::path::PathBuf;
    ///
    /// let mut path = PathBuf::from("/tmp");
    /// path.push("file.bk");
    /// assert_eq!(path, PathBuf::from("/tmp/file.bk"));
    /// ```
    ///
    /// 推送绝对路径会替换现有的路径：
    ///
    /// ```
    /// use std::path::PathBuf;
    ///
    /// let mut path = PathBuf::from("/tmp");
    /// path.push("/etc");
    /// assert_eq!(path, PathBuf::from("/etc"));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_confusables("append", "put")]
    pub fn push<P: AsRef<Path>>(&mut self, path: P) {
        self._push(path.as_ref())
    }

    fn _push(&mut self, path: &Path) {
        // in general, a separator is needed if the rightmost byte is not a separator
        let buf = self.inner.as_encoded_bytes();
        let mut need_sep = buf.last().map(|c| !is_sep_byte(*c)).unwrap_or(false);

        let self_comps = self.components();
        let self_prefix_len = self_comps.prefix_len();

        // in the special case of `C:` on Windows, do *not* add a separator
        if self_prefix_len > 0
            && self_prefix_len == self_comps.path.len()
            && self_comps.prefix.unwrap().is_drive()
        {
            need_sep = false
        }

        let path_comps = path.components();

        let need_clear = if cfg!(any(target_os = "windows", target_os = "cygwin")) {
            // Windows/Cygwin: If path is absolute and its prefix is none, it is like `\foo`
            // (Windows) or `/foo` (Cygwin), and will be handled below.
            path_comps.prefix.is_some()
        } else {
            // On Unix: prefix is always None.
            path.is_absolute() || path_comps.prefix.is_some()
        };

        // absolute `path` replaces `self`
        if need_clear {
            self.inner.clear();

        // verbatim paths need . and .. removed
        } else if self_comps.prefix_verbatim() && !path.inner.is_empty() {
            let mut buf: Vec<_> = self_comps.collect();
            for c in path_comps {
                match c {
                    Component::RootDir => {
                        buf.truncate(1);
                        buf.push(c);
                    }
                    Component::CurDir => (),
                    Component::ParentDir => {
                        if let Some(Component::Normal(_)) = buf.last() {
                            buf.pop();
                        }
                    }
                    _ => buf.push(c),
                }
            }

            let mut res = OsString::new();
            let mut need_sep = false;

            for c in buf {
                if need_sep && c != Component::RootDir {
                    res.push(MAIN_SEPARATOR_STR);
                }
                res.push(c.as_os_str());
                need_sep = c != Component::RootDir;
            }

            self.inner = res;
            return;

        // `path` has a root but no prefix, e.g., `\windows` (Windows only)
        } else if path_comps.has_root() {
            self.inner.truncate(self_prefix_len);

        // `path` is a pure relative path
        } else if need_sep {
            self.inner.push(MAIN_SEPARATOR_STR);
        }

        self.inner.push(path);
    }

    /// Truncates `self` to [`self.parent`].
    ///
    /// Returns `false` and does nothing if [`self.parent`] is [`None`].
    /// Otherwise, returns `true`.
    ///
    /// [`self.parent`]: Path::parent
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::{Path, PathBuf};
    ///
    /// let mut p = PathBuf::from("/spirited/away.rs");
    ///
    /// p.pop();
    /// assert_eq!(Path::new("/spirited"), p);
    /// p.pop();
    /// assert_eq!(Path::new("/"), p);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn pop(&mut self) -> bool {
        match self.parent().map(|p| p.as_u8_slice().len()) {
            Some(len) => {
                self.inner.truncate(len);
                true
            }
            None => false,
        }
    }

    /// Sets whether the path has a trailing [separator](MAIN_SEPARATOR).
    ///
    /// The value returned by [`has_trailing_sep`](Path::has_trailing_sep) will be equivalent to
    /// 提供的数值。
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(path_trailing_sep)]
    /// use std::path::PathBuf;
    ///
    /// let mut p = PathBuf::from("dir");
    ///
    /// assert!(!p.has_trailing_sep());
    /// p.set_trailing_sep(false);
    /// assert!(!p.has_trailing_sep());
    /// p.set_trailing_sep(true);
    /// assert!(p.has_trailing_sep());
    /// p.set_trailing_sep(false);
    /// assert!(!p.has_trailing_sep());
    ///
    /// p = PathBuf::from("/");
    /// assert!(p.has_trailing_sep());
    /// p.set_trailing_sep(false);
    /// assert!(p.has_trailing_sep());
    /// ```
    #[unstable(feature = "path_trailing_sep", issue = "142503")]
    pub fn set_trailing_sep(&mut self, trailing_sep: bool) {
        if trailing_sep { self.push_trailing_sep() } else { self.pop_trailing_sep() }
    }

    /// Adds a trailing [separator](MAIN_SEPARATOR) to the path.
    ///
    /// This acts similarly to [`Path::with_trailing_sep`], but mutates the underlying `PathBuf`.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(path_trailing_sep)]
    /// use std::ffi::OsStr;
    /// use std::path::PathBuf;
    ///
    /// let mut p = PathBuf::from("dir");
    ///
    /// assert!(!p.has_trailing_sep());
    /// p.push_trailing_sep();
    /// assert!(p.has_trailing_sep());
    /// p.push_trailing_sep();
    /// assert!(p.has_trailing_sep());
    ///
    /// p = PathBuf::from("dir/");
    /// p.push_trailing_sep();
    /// assert_eq!(p.as_os_str(), OsStr::new("dir/"));
    /// ```
    #[unstable(feature = "path_trailing_sep", issue = "142503")]
    pub fn push_trailing_sep(&mut self) {
        if !self.has_trailing_sep() {
            self.push("");
        }
    }

    /// Removes a trailing [separator](MAIN_SEPARATOR) from the path, if possible.
    ///
    /// This acts similarly to [`Path::trim_trailing_sep`], but mutates the underlying `PathBuf`.
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(path_trailing_sep)]
    /// use std::ffi::OsStr;
    /// use std::path::PathBuf;
    ///
    /// let mut p = PathBuf::from("dir//");
    ///
    /// assert!(p.has_trailing_sep());
    /// assert_eq!(p.as_os_str(), OsStr::new("dir//"));
    /// p.pop_trailing_sep();
    /// assert!(!p.has_trailing_sep());
    /// assert_eq!(p.as_os_str(), OsStr::new("dir"));
    /// p.pop_trailing_sep();
    /// assert!(!p.has_trailing_sep());
    /// assert_eq!(p.as_os_str(), OsStr::new("dir"));
    ///
    /// p = PathBuf::from("/");
    /// assert!(p.has_trailing_sep());
    /// p.pop_trailing_sep();
    /// assert!(p.has_trailing_sep());
    /// ```
    #[unstable(feature = "path_trailing_sep", issue = "142503")]
    pub fn pop_trailing_sep(&mut self) {
        self.inner.truncate(self.trim_trailing_sep().as_os_str().len());
    }

    /// Updates [`self.file_name`] to `file_name`.
    ///
    /// If [`self.file_name`] was [`None`], this is equivalent to pushing
    /// `file_name`.
    ///
    /// Otherwise it is equivalent to calling [`pop`] and then pushing
    /// `file_name`. The new path will be a sibling of the original path.
    /// （即，它将具有相同的父路径。）
    ///
    /// 参数未经过清理，因此可以包含分隔符。此行为未来可能会变为 panic。
    /// # 示例
    ///
    /// [`self.file_name`]: Path::file_name
    /// [`pop`]: PathBuf::pop
    ///
    /// # 如果
    ///
    /// ```
    /// use std::path::PathBuf;
    ///
    /// let mut buf = PathBuf::from("/");
    /// assert!(buf.file_name() == None);
    ///
    /// buf.set_file_name("foo.txt");
    /// assert!(buf == PathBuf::from("/foo.txt"));
    /// assert!(buf.file_name().is_some());
    ///
    /// buf.set_file_name("bar.txt");
    /// assert!(buf == PathBuf::from("/bar.txt"));
    ///
    /// buf.set_file_name("baz");
    /// assert!(buf == PathBuf::from("/baz"));
    ///
    /// buf.set_file_name("../b/c.txt");
    /// assert!(buf == PathBuf::from("/../b/c.txt"));
    ///
    /// buf.set_file_name("baz");
    /// assert!(buf == PathBuf::from("/../b/baz"));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn set_file_name<S: AsRef<OsStr>>(&mut self, file_name: S) {
        self._set_file_name(file_name.as_ref())
    }

    fn _set_file_name(&mut self, file_name: &OsStr) {
        if self.file_name().is_some() {
            let popped = self.pop();
            debug_assert!(popped);
        }
        self.push(file_name);
    }

    /// Updates [`self.extension`] to `Some(extension)` or to `None` if
    /// `extension` is empty.
    ///
    /// Returns `false` and does nothing if [`self.file_name`] is [`None`],
    /// returns `true` and updates the extension otherwise.
    ///
    /// If [`self.extension`] is [`None`], the extension is added; otherwise
    /// 则被替换。
    ///
    /// If `extension` is the empty string, [`self.extension`] will be [`None`]
    /// afterwards, not `Some("")`.
    ///
    /// # panic
    ///
    /// 如果传递的扩展名包含路径分隔符，则触发 panic（参见
    /// [`is_separator`]).
    ///
    /// # 注意事项
    ///
    /// The new `extension` may contain dots and will be used in its entirety,
    /// 但只有最后一个点之后的部分才会反映在
    /// [`self.extension`].
    ///
    /// If the file stem contains internal dots and `extension` is empty, part
    /// of the old file stem will be considered the new [`self.extension`].
    ///
    /// 请参见下面的示例。
    ///
    /// [`self.file_name`]: Path::file_name
    /// [`self.extension`]: Path::extension
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::{Path, PathBuf};
    ///
    /// let mut p = PathBuf::from("/feel/the");
    ///
    /// p.set_extension("force");
    /// assert_eq!(Path::new("/feel/the.force"), p.as_path());
    ///
    /// p.set_extension("dark.side");
    /// assert_eq!(Path::new("/feel/the.dark.side"), p.as_path());
    ///
    /// p.set_extension("cookie");
    /// assert_eq!(Path::new("/feel/the.dark.cookie"), p.as_path());
    ///
    /// p.set_extension("");
    /// assert_eq!(Path::new("/feel/the.dark"), p.as_path());
    ///
    /// p.set_extension("");
    /// assert_eq!(Path::new("/feel/the"), p.as_path());
    ///
    /// p.set_extension("");
    /// assert_eq!(Path::new("/feel/the"), p.as_path());
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn set_extension<S: AsRef<OsStr>>(&mut self, extension: S) -> bool {
        self._set_extension(extension.as_ref())
    }

    fn _set_extension(&mut self, extension: &OsStr) -> bool {
        validate_extension(extension);

        let file_stem = match self.file_stem() {
            None => return false,
            Some(f) => f.as_encoded_bytes(),
        };

        // truncate until right after the file stem
        let end_file_stem = file_stem[file_stem.len()..].as_ptr().addr();
        let start = self.inner.as_encoded_bytes().as_ptr().addr();
        self.inner.truncate(end_file_stem.wrapping_sub(start));

        // add the new extension, if any
        let new = extension.as_encoded_bytes();
        if !new.is_empty() {
            self.inner.reserve_exact(new.len() + 1);
            self.inner.push(".");
            // SAFETY: Since a UTF-8 string was just pushed, it is not possible
            // for the buffer to end with a surrogate half.
            unsafe { self.inner.extend_from_slice_unchecked(new) };
        }

        true
    }

    /// Append [`self.extension`] with `extension`.
    ///
    /// Returns `false` and does nothing if [`self.file_name`] is [`None`],
    /// returns `true` and updates the extension otherwise.
    ///
    /// # panic
    ///
    /// 如果传递的扩展名包含路径分隔符，则触发 panic（参见
    /// [`is_separator`]).
    ///
    /// # 注意事项
    ///
    /// The appended `extension` may contain dots and will be used in its entirety,
    /// 但只有最后一个点之后的部分才会反映在
    /// [`self.extension`].
    ///
    /// 请参见下面的示例。
    ///
    /// [`self.file_name`]: Path::file_name
    /// [`self.extension`]: Path::extension
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::{Path, PathBuf};
    ///
    /// let mut p = PathBuf::from("/feel/the");
    ///
    /// p.add_extension("formatted");
    /// assert_eq!(Path::new("/feel/the.formatted"), p.as_path());
    ///
    /// p.add_extension("dark.side");
    /// assert_eq!(Path::new("/feel/the.formatted.dark.side"), p.as_path());
    ///
    /// p.set_extension("cookie");
    /// assert_eq!(Path::new("/feel/the.formatted.dark.cookie"), p.as_path());
    ///
    /// p.set_extension("");
    /// assert_eq!(Path::new("/feel/the.formatted.dark"), p.as_path());
    ///
    /// p.add_extension("");
    /// assert_eq!(Path::new("/feel/the.formatted.dark"), p.as_path());
    /// ```
    #[stable(feature = "path_add_extension", since = "1.91.0")]
    pub fn add_extension<S: AsRef<OsStr>>(&mut self, extension: S) -> bool {
        self._add_extension(extension.as_ref())
    }

    fn _add_extension(&mut self, extension: &OsStr) -> bool {
        validate_extension(extension);

        let file_name = match self.file_name() {
            None => return false,
            Some(f) => f.as_encoded_bytes(),
        };

        let new = extension.as_encoded_bytes();
        if !new.is_empty() {
            // truncate until right after the file name
            // this is necessary for trimming the trailing separator
            let end_file_name = file_name[file_name.len()..].as_ptr().addr();
            let start = self.inner.as_encoded_bytes().as_ptr().addr();
            self.inner.truncate(end_file_name.wrapping_sub(start));

            // append the new extension
            self.inner.reserve_exact(new.len() + 1);
            self.inner.push(".");
            // SAFETY: Since a UTF-8 string was just pushed, it is not possible
            // for the buffer to end with a surrogate half.
            unsafe { self.inner.extend_from_slice_unchecked(new) };
        }

        true
    }

    /// Yields a mutable reference to the underlying [`OsString`] instance.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::{Path, PathBuf};
    ///
    /// let mut path = PathBuf::from("/foo");
    ///
    /// path.push("bar");
    /// assert_eq!(path, Path::new("/foo/bar"));
    ///
    /// // OsString's `push` does not add a separator.
    /// path.as_mut_os_string().push("baz");
    /// assert_eq!(path, Path::new("/foo/barbaz"));
    /// ```
    #[stable(feature = "path_as_mut_os_str", since = "1.70.0")]
    #[must_use]
    #[inline]
    pub fn as_mut_os_string(&mut self) -> &mut OsString {
        &mut self.inner
    }

    /// Consumes the `PathBuf`, yielding its internal [`OsString`] storage.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::PathBuf;
    ///
    /// let p = PathBuf::from("/the/head");
    /// let os_str = p.into_os_string();
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use = "`self` will be dropped if the result is not used"]
    #[inline]
    pub fn into_os_string(self) -> OsString {
        self.inner
    }

    /// Converts the `PathBuf` into a `String` if it contains valid Unicode data.
    ///
    /// On failure, ownership of the original `PathBuf` is returned.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::PathBuf;
    ///
    /// let path_buf = PathBuf::from("foo");
    /// let string = path_buf.into_string();
    /// assert_eq!(string, Ok(String::from("foo")));
    /// ```
    #[stable(feature = "pathbuf_into_string", since = "1.98.0")]
    pub fn into_string(self) -> Result<String, PathBuf> {
        self.into_os_string().into_string().map_err(PathBuf::from)
    }

    /// Converts this `PathBuf` into a [boxed](Box) [`Path`].
    #[stable(feature = "into_boxed_path", since = "1.20.0")]
    #[must_use = "`self` will be dropped if the result is not used"]
    #[inline]
    pub fn into_boxed_path(self) -> Box<Path> {
        let rw = Box::into_raw(self.inner.into_boxed_os_str()) as *mut Path;
        unsafe { Box::from_raw(rw) }
    }

    /// Invokes [`capacity`] on the underlying instance of [`OsString`].
    ///
    /// [`capacity`]: OsString::capacity
    #[stable(feature = "path_buf_capacity", since = "1.44.0")]
    #[must_use]
    #[inline]
    pub fn capacity(&self) -> usize {
        self.inner.capacity()
    }

    /// Invokes [`clear`] on the underlying instance of [`OsString`].
    ///
    /// [`clear`]: OsString::clear
    #[stable(feature = "path_buf_capacity", since = "1.44.0")]
    #[inline]
    pub fn clear(&mut self) {
        self.inner.clear()
    }

    /// Invokes [`reserve`] on the underlying instance of [`OsString`].
    ///
    /// [`reserve`]: OsString::reserve
    #[stable(feature = "path_buf_capacity", since = "1.44.0")]
    #[inline]
    pub fn reserve(&mut self, additional: usize) {
        self.inner.reserve(additional)
    }

    /// Invokes [`try_reserve`] on the underlying instance of [`OsString`].
    ///
    /// [`try_reserve`]: OsString::try_reserve
    #[stable(feature = "try_reserve_2", since = "1.63.0")]
    #[inline]
    pub fn try_reserve(&mut self, additional: usize) -> Result<(), TryReserveError> {
        self.inner.try_reserve(additional)
    }

    /// Invokes [`reserve_exact`] on the underlying instance of [`OsString`].
    ///
    /// [`reserve_exact`]: OsString::reserve_exact
    #[stable(feature = "path_buf_capacity", since = "1.44.0")]
    #[inline]
    pub fn reserve_exact(&mut self, additional: usize) {
        self.inner.reserve_exact(additional)
    }

    /// Invokes [`try_reserve_exact`] on the underlying instance of [`OsString`].
    ///
    /// [`try_reserve_exact`]: OsString::try_reserve_exact
    #[stable(feature = "try_reserve_2", since = "1.63.0")]
    #[inline]
    pub fn try_reserve_exact(&mut self, additional: usize) -> Result<(), TryReserveError> {
        self.inner.try_reserve_exact(additional)
    }

    /// Invokes [`shrink_to_fit`] on the underlying instance of [`OsString`].
    ///
    /// [`shrink_to_fit`]: OsString::shrink_to_fit
    #[stable(feature = "path_buf_capacity", since = "1.44.0")]
    #[inline]
    pub fn shrink_to_fit(&mut self) {
        self.inner.shrink_to_fit()
    }

    /// Invokes [`shrink_to`] on the underlying instance of [`OsString`].
    ///
    /// [`shrink_to`]: OsString::shrink_to
    #[stable(feature = "shrink_to", since = "1.56.0")]
    #[inline]
    pub fn shrink_to(&mut self, min_capacity: usize) {
        self.inner.shrink_to(min_capacity)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Clone for PathBuf {
    #[inline]
    fn clone(&self) -> Self {
        PathBuf { inner: self.inner.clone() }
    }

    /// Clones the contents of `source` into `self`.
    ///
    /// This method is preferred over simply assigning `source.clone()` to `self`,
    /// 因为可以在可能的情况下避免重新分配。
    #[inline]
    fn clone_from(&mut self, source: &Self) {
        self.inner.clone_from(&source.inner)
    }
}

#[stable(feature = "box_from_path", since = "1.17.0")]
impl From<&Path> for Box<Path> {
    /// Creates a boxed [`Path`] from a reference.
    ///
    /// This will allocate and clone `path` to it.
    fn from(path: &Path) -> Box<Path> {
        Box::clone_from_ref(path)
    }
}

#[stable(feature = "box_from_mut_slice", since = "1.84.0")]
impl From<&mut Path> for Box<Path> {
    /// Creates a boxed [`Path`] from a reference.
    ///
    /// This will allocate and clone `path` to it.
    fn from(path: &mut Path) -> Box<Path> {
        Self::from(&*path)
    }
}

#[stable(feature = "box_from_cow", since = "1.45.0")]
impl From<Cow<'_, Path>> for Box<Path> {
    /// Creates a boxed [`Path`] from a clone-on-write pointer.
    ///
    /// Converting from a `Cow::Owned` does not clone or allocate.
    #[inline]
    fn from(cow: Cow<'_, Path>) -> Box<Path> {
        match cow {
            Cow::Borrowed(path) => Box::from(path),
            Cow::Owned(path) => Box::from(path),
        }
    }
}

#[stable(feature = "path_buf_from_box", since = "1.18.0")]
impl From<Box<Path>> for PathBuf {
    /// Converts a <code>[Box]&lt;[Path]&gt;</code> into a [`PathBuf`].
    ///
    /// 此转换不会进行分配或复制内存。
    #[inline]
    fn from(boxed: Box<Path>) -> PathBuf {
        boxed.into_path_buf()
    }
}

#[stable(feature = "box_from_path_buf", since = "1.20.0")]
impl From<PathBuf> for Box<Path> {
    /// Converts a [`PathBuf`] into a <code>[Box]&lt;[Path]&gt;</code>.
    ///
    /// 目前此转换不应分配内存，
    /// 但此行为并非在所有平台或未来版本中都有保证。
    #[inline]
    fn from(p: PathBuf) -> Box<Path> {
        p.into_boxed_path()
    }
}

#[stable(feature = "more_box_slice_clone", since = "1.29.0")]
impl<A: Allocator + Clone> Clone for Box<Path, A> {
    #[inline]
    fn clone(&self) -> Self {
        Box::clone_from_ref_in(&**self, Self::allocator(self).clone())
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<T: ?Sized + AsRef<OsStr>> From<&T> for PathBuf {
    /// Converts a borrowed [`OsStr`] to a [`PathBuf`].
    ///
    /// Allocates a [`PathBuf`] and copies the data into it.
    #[inline]
    fn from(s: &T) -> PathBuf {
        PathBuf::from(s.as_ref().to_os_string())
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl From<OsString> for PathBuf {
    /// Converts an [`OsString`] into a [`PathBuf`].
    ///
    /// 此转换不会进行分配或复制内存。
    #[inline]
    fn from(s: OsString) -> PathBuf {
        PathBuf { inner: s }
    }
}

#[stable(feature = "from_path_buf_for_os_string", since = "1.14.0")]
impl From<PathBuf> for OsString {
    /// Converts a [`PathBuf`] into an [`OsString`]
    ///
    /// 此转换不会进行分配或复制内存。
    #[inline]
    fn from(path_buf: PathBuf) -> OsString {
        path_buf.inner
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl From<String> for PathBuf {
    /// Converts a [`String`] into a [`PathBuf`]
    ///
    /// 此转换不会进行分配或复制内存。
    #[inline]
    fn from(s: String) -> PathBuf {
        PathBuf::from(OsString::from(s))
    }
}

#[stable(feature = "path_from_str", since = "1.32.0")]
impl FromStr for PathBuf {
    type Err = !;

    #[inline]
    fn from_str(s: &str) -> Result<Self, !> {
        Ok(PathBuf::from(s))
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<P: AsRef<Path>> FromIterator<P> for PathBuf {
    /// Creates a new `PathBuf` from the [`Path`] elements of an iterator.
    ///
    /// This uses [`push`](Self::push) to add each element, so can be used to adjoin multiple path
    /// [components](Components).
    ///
    /// # 示例
    /// ```
    /// # use std::path::PathBuf;
    /// let path = PathBuf::from_iter(["/tmp", "foo", "bar"]);
    /// assert_eq!(path, PathBuf::from("/tmp/foo/bar"));
    /// ```
    ///
    /// See documentation for [`push`](Self::push) for more details on how the path is constructed.
    fn from_iter<I: IntoIterator<Item = P>>(iter: I) -> PathBuf {
        let mut buf = PathBuf::new();
        buf.extend(iter);
        buf
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl<P: AsRef<Path>> Extend<P> for PathBuf {
    /// Extends `self` with [`Path`] elements from `iter`.
    ///
    /// This uses [`push`](Self::push) to add each element, so can be used to adjoin multiple path
    /// [components](Components).
    ///
    /// # 示例
    /// ```
    /// # use std::path::PathBuf;
    /// let mut path = PathBuf::from("/tmp");
    /// path.extend(["foo", "bar", "file.txt"]);
    /// assert_eq!(path, PathBuf::from("/tmp/foo/bar/file.txt"));
    /// ```
    ///
    /// See documentation for [`push`](Self::push) for more details on how the path is constructed.
    fn extend<I: IntoIterator<Item = P>>(&mut self, iter: I) {
        iter.into_iter().for_each(move |p| self.push(p.as_ref()));
    }

    #[inline]
    fn extend_one(&mut self, p: P) {
        self.push(p.as_ref());
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl fmt::Debug for PathBuf {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Debug::fmt(&**self, formatter)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl ops::Deref for PathBuf {
    type Target = Path;
    #[inline]
    fn deref(&self) -> &Path {
        Path::new(&self.inner)
    }
}

#[stable(feature = "path_buf_deref_mut", since = "1.68.0")]
impl ops::DerefMut for PathBuf {
    #[inline]
    fn deref_mut(&mut self) -> &mut Path {
        Path::from_inner_mut(&mut self.inner)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Borrow<Path> for PathBuf {
    #[inline]
    fn borrow(&self) -> &Path {
        self.deref()
    }
}

#[stable(feature = "default_for_pathbuf", since = "1.17.0")]
impl Default for PathBuf {
    #[inline]
    fn default() -> Self {
        PathBuf::new()
    }
}

#[stable(feature = "cow_from_path", since = "1.6.0")]
impl<'a> From<&'a Path> for Cow<'a, Path> {
    /// 从引用创建写时克隆指针
    /// [`Path`].
    ///
    /// 此转换不会进行克隆或分配。
    #[inline]
    fn from(s: &'a Path) -> Cow<'a, Path> {
        Cow::Borrowed(s)
    }
}

#[stable(feature = "cow_from_path", since = "1.6.0")]
impl<'a> From<PathBuf> for Cow<'a, Path> {
    /// 从拥有权
    /// instance of [`PathBuf`].
    ///
    /// 此转换不会进行克隆或分配。
    #[inline]
    fn from(s: PathBuf) -> Cow<'a, Path> {
        Cow::Owned(s)
    }
}

#[stable(feature = "cow_from_pathbuf_ref", since = "1.28.0")]
impl<'a> From<&'a PathBuf> for Cow<'a, Path> {
    /// 从引用创建写时克隆指针
    /// [`PathBuf`].
    ///
    /// 此转换不会进行克隆或分配。
    #[inline]
    fn from(p: &'a PathBuf) -> Cow<'a, Path> {
        Cow::Borrowed(p.as_path())
    }
}

#[stable(feature = "pathbuf_from_cow_path", since = "1.28.0")]
impl<'a> From<Cow<'a, Path>> for PathBuf {
    /// 将写时克隆指针转换为拥有权路径。
    ///
    /// Converting from a `Cow::Owned` does not clone or allocate.
    #[inline]
    fn from(p: Cow<'a, Path>) -> Self {
        p.into_owned()
    }
}

#[stable(feature = "shared_from_slice2", since = "1.24.0")]
impl From<PathBuf> for Arc<Path> {
    /// Converts a [`PathBuf`] into an <code>[Arc]<[Path]></code> by moving the [`PathBuf`] data
    /// into a new [`Arc`] buffer.
    #[inline]
    fn from(s: PathBuf) -> Arc<Path> {
        let arc: Arc<OsStr> = Arc::from(s.into_os_string());
        unsafe { Arc::from_raw(Arc::into_raw(arc) as *const Path) }
    }
}

#[stable(feature = "shared_from_slice2", since = "1.24.0")]
impl From<&Path> for Arc<Path> {
    /// Converts a [`Path`] into an [`Arc`] by copying the [`Path`] data into a new [`Arc`] buffer.
    #[inline]
    fn from(s: &Path) -> Arc<Path> {
        let arc: Arc<OsStr> = Arc::from(s.as_os_str());
        unsafe { Arc::from_raw(Arc::into_raw(arc) as *const Path) }
    }
}

#[stable(feature = "shared_from_mut_slice", since = "1.84.0")]
impl From<&mut Path> for Arc<Path> {
    /// Converts a [`Path`] into an [`Arc`] by copying the [`Path`] data into a new [`Arc`] buffer.
    #[inline]
    fn from(s: &mut Path) -> Arc<Path> {
        Arc::from(&*s)
    }
}

#[stable(feature = "shared_from_slice2", since = "1.24.0")]
impl From<PathBuf> for Rc<Path> {
    /// Converts a [`PathBuf`] into an <code>[Rc]<[Path]></code> by moving the [`PathBuf`] data into
    /// a new [`Rc`] buffer.
    #[inline]
    fn from(s: PathBuf) -> Rc<Path> {
        let rc: Rc<OsStr> = Rc::from(s.into_os_string());
        unsafe { Rc::from_raw(Rc::into_raw(rc) as *const Path) }
    }
}

#[stable(feature = "shared_from_slice2", since = "1.24.0")]
impl From<&Path> for Rc<Path> {
    /// Converts a [`Path`] into an [`Rc`] by copying the [`Path`] data into a new [`Rc`] buffer.
    #[inline]
    fn from(s: &Path) -> Rc<Path> {
        let rc: Rc<OsStr> = Rc::from(s.as_os_str());
        unsafe { Rc::from_raw(Rc::into_raw(rc) as *const Path) }
    }
}

#[stable(feature = "shared_from_mut_slice", since = "1.84.0")]
impl From<&mut Path> for Rc<Path> {
    /// Converts a [`Path`] into an [`Rc`] by copying the [`Path`] data into a new [`Rc`] buffer.
    #[inline]
    fn from(s: &mut Path) -> Rc<Path> {
        Rc::from(&*s)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl ToOwned for Path {
    type Owned = PathBuf;
    #[inline]
    fn to_owned(&self) -> PathBuf {
        self.to_path_buf()
    }
    #[inline]
    fn clone_into(&self, target: &mut PathBuf) {
        self.inner.clone_into(&mut target.inner);
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl PartialEq for PathBuf {
    #[inline]
    fn eq(&self, other: &PathBuf) -> bool {
        self.components() == other.components()
    }
}

#[stable(feature = "eq_str_for_path", since = "1.91.0")]
impl cmp::PartialEq<str> for PathBuf {
    #[inline]
    fn eq(&self, other: &str) -> bool {
        self.as_path() == other
    }
}

#[stable(feature = "eq_str_for_path", since = "1.91.0")]
impl cmp::PartialEq<PathBuf> for str {
    #[inline]
    fn eq(&self, other: &PathBuf) -> bool {
        self == other.as_path()
    }
}

#[stable(feature = "eq_str_for_path", since = "1.91.0")]
impl cmp::PartialEq<String> for PathBuf {
    #[inline]
    fn eq(&self, other: &String) -> bool {
        self.as_path() == other.as_str()
    }
}

#[stable(feature = "eq_str_for_path", since = "1.91.0")]
impl cmp::PartialEq<PathBuf> for String {
    #[inline]
    fn eq(&self, other: &PathBuf) -> bool {
        self.as_str() == other.as_path()
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Hash for PathBuf {
    fn hash<H: Hasher>(&self, h: &mut H) {
        self.as_path().hash(h)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Eq for PathBuf {}

#[stable(feature = "rust1", since = "1.0.0")]
impl PartialOrd for PathBuf {
    #[inline]
    fn partial_cmp(&self, other: &PathBuf) -> Option<cmp::Ordering> {
        Some(compare_components(self.components(), other.components()))
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Ord for PathBuf {
    #[inline]
    fn cmp(&self, other: &PathBuf) -> cmp::Ordering {
        compare_components(self.components(), other.components())
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl AsRef<OsStr> for PathBuf {
    #[inline]
    fn as_ref(&self) -> &OsStr {
        &self.inner[..]
    }
}

/// A slice of a path (akin to [`str`]).
///
/// 此类型支持多种操作以检查路径，包括
/// breaking the path into its components (separated by `/` on Unix and by either
/// `/` or `\` on Windows), extracting the file name, determining whether the path
/// 是否为绝对路径等。
///
/// 这是一个*无大小*的类型，意味着它必须始终在
/// pointer like `&` or [`Box`]. For an owned version of this type,
/// see [`PathBuf`].
///
/// 关于整体方法的更多细节可以在
/// the [module documentation](self).
///
/// # 示例
///
/// ```
/// use std::path::Path;
/// use std::ffi::OsStr;
///
/// // Note: this example does work on Windows
/// let path = Path::new("./foo/bar.txt");
///
/// let parent = path.parent();
/// assert_eq!(parent, Some(Path::new("./foo")));
///
/// let file_stem = path.file_stem();
/// assert_eq!(file_stem, Some(OsStr::new("bar")));
///
/// let extension = path.extension();
/// assert_eq!(extension, Some(OsStr::new("txt")));
/// ```
#[cfg_attr(not(test), rustc_diagnostic_item = "Path")]
#[stable(feature = "rust1", since = "1.0.0")]
// `Path::new` and `impl CloneToUninit for Path` current implementation relies
// on `Path` being layout-compatible with `OsStr`.
// However, `Path` layout is considered an implementation detail and must not be relied upon.
#[repr(transparent)]
pub struct Path {
    inner: OsStr,
}

/// An error returned from [`Path::strip_prefix`] if the prefix was not found.
///
/// This `struct` is created by the [`strip_prefix`] method on [`Path`].
/// 更多详情请参阅其文档。
///
/// [`strip_prefix`]: Path::strip_prefix
#[derive(Debug, Clone, PartialEq, Eq)]
#[stable(since = "1.7.0", feature = "strip_prefix")]
pub struct StripPrefixError(());

/// An error returned from [`Path::normalize_lexically`] if a `..` parent reference
/// would escape the path.
#[unstable(feature = "normalize_lexically", issue = "134694")]
#[derive(Debug, PartialEq)]
#[non_exhaustive]
pub struct NormalizeError;

impl Path {
    // The following (private!) function allows construction of a path from a u8
    // slice, which is only safe when it is known to follow the OsStr encoding.
    pub(crate) unsafe fn from_u8_slice(s: &[u8]) -> &Path {
        unsafe { Path::new(OsStr::from_encoded_bytes_unchecked(s)) }
    }
    // The following (private!) function reveals the byte encoding used for OsStr.
    pub(crate) fn as_u8_slice(&self) -> &[u8] {
        self.inner.as_encoded_bytes()
    }

    /// Directly wraps a string slice as a `Path` slice.
    ///
    /// 这是无成本的转换。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::Path;
    ///
    /// Path::new("foo.txt");
    /// ```
    ///
    /// You can create `Path`s from `String`s, or even other `Path`s:
    ///
    /// ```
    /// use std::path::Path;
    ///
    /// let string = String::from("foo.txt");
    /// let from_string = Path::new(&string);
    /// let from_path = Path::new(&from_string);
    /// assert_eq!(from_string, from_path);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_convert", issue = "143773")]
    pub const fn new<S: [const] AsRef<OsStr> + ?Sized>(s: &S) -> &Path {
        unsafe { &*(s.as_ref() as *const OsStr as *const Path) }
    }

    #[rustc_const_unstable(feature = "const_convert", issue = "143773")]
    const fn from_inner_mut(inner: &mut OsStr) -> &mut Path {
        // SAFETY: Path is just a wrapper around OsStr,
        // therefore converting &mut OsStr to &mut Path is safe.
        unsafe { &mut *(inner as *mut OsStr as *mut Path) }
    }

    /// Yields the underlying [`OsStr`] slice.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::Path;
    ///
    /// let os_str = Path::new("foo.txt").as_os_str();
    /// assert_eq!(os_str, std::ffi::OsStr::new("foo.txt"));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    #[inline]
    pub fn as_os_str(&self) -> &OsStr {
        &self.inner
    }

    /// Yields a mutable reference to the underlying [`OsStr`] slice.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::{Path, PathBuf};
    ///
    /// let mut path = PathBuf::from("Foo.TXT");
    ///
    /// assert_ne!(path, Path::new("foo.txt"));
    ///
    /// path.as_mut_os_str().make_ascii_lowercase();
    /// assert_eq!(path, Path::new("foo.txt"));
    /// ```
    #[stable(feature = "path_as_mut_os_str", since = "1.70.0")]
    #[must_use]
    #[inline]
    pub fn as_mut_os_str(&mut self) -> &mut OsStr {
        &mut self.inner
    }

    /// Yields a [`&str`] slice if the `Path` is valid unicode.
    ///
    /// 此转换可能需要进行 UTF-8 有效性检查。
    /// 请注意，进行验证是因为非 UTF-8 字符串在某些操作系统上
    /// 是完全有效的。
    ///
    /// [`&str`]: str
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::Path;
    ///
    /// let path = Path::new("foo.txt");
    /// assert_eq!(path.to_str(), Some("foo.txt"));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use = "this returns the result of the operation, \
                  without modifying the original"]
    #[inline]
    pub fn to_str(&self) -> Option<&str> {
        self.inner.to_str()
    }

    /// Converts a `Path` to a [`Cow<str>`].
    ///
    /// 任何非 UTF-8 序列都会被替换为
    /// [`U+FFFD REPLACEMENT CHARACTER`][U+FFFD].
    ///
    /// [U+FFFD]: char::REPLACEMENT_CHARACTER
    ///
    /// # 示例
    ///
    /// Calling `to_string_lossy` on a `Path` with valid unicode:
    ///
    /// ```
    /// use std::path::Path;
    ///
    /// let path = Path::new("foo.txt");
    /// assert_eq!(path.to_string_lossy(), "foo.txt");
    /// ```
    ///
    /// Had `path` contained invalid unicode, the `to_string_lossy` call might
    /// have returned `"fo�.txt"`.
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use = "this returns the result of the operation, \
                  without modifying the original"]
    #[inline]
    pub fn to_string_lossy(&self) -> Cow<'_, str> {
        self.inner.to_string_lossy()
    }

    /// Converts a `Path` to an owned [`PathBuf`].
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::{Path, PathBuf};
    ///
    /// let path_buf = Path::new("foo.txt").to_path_buf();
    /// assert_eq!(path_buf, PathBuf::from("foo.txt"));
    /// ```
    #[rustc_conversion_suggestion]
    #[must_use = "this returns the result of the operation, \
                  without modifying the original"]
    #[stable(feature = "rust1", since = "1.0.0")]
    #[cfg_attr(not(test), rustc_diagnostic_item = "path_to_pathbuf")]
    pub fn to_path_buf(&self) -> PathBuf {
        PathBuf::from(self.inner.to_os_string())
    }

    /// Returns `true` if the `Path` is absolute, i.e., if it is independent of
    /// * 在 Unix 系统上，如果路径以根目录开头，则视为绝对路径，因此
    ///
    /// * On Unix, a path is absolute if it starts with the root, so
    /// `is_absolute` and [`has_root`] are equivalent.
    ///
    /// # 示例
    /// root: `c:\windows` is absolute, while `c:temp` and `\temp` are not.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::Path;
    ///
    /// assert!(!Path::new("foo.txt").is_absolute());
    /// ```
    ///
    /// [`has_root`]: Path::has_root
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    #[allow(deprecated)]
    pub fn is_absolute(&self) -> bool {
        sys::path::is_absolute(self)
    }

    /// Returns `true` if the `Path` is relative, i.e., not absolute.
    ///
    /// See [`is_absolute`]'s documentation for more details.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::Path;
    ///
    /// assert!(Path::new("foo.txt").is_relative());
    /// ```
    ///
    /// [`is_absolute`]: Path::is_absolute
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    #[inline]
    pub fn is_relative(&self) -> bool {
        !self.is_absolute()
    }

    #[cfg(not(target_os = "uefi"))]
    pub(crate) fn prefix(&self) -> Option<Prefix<'_>> {
        self.components().prefix
    }

    /// Returns `true` if the `Path` has a root.
    ///
    /// * On Unix, a path has a root if it begins with `/`.
    ///
    /// * 在 Windows 系统上，如果路径：
    ///     * has no prefix and begins with a separator, e.g., `\windows`
    ///     * has a prefix followed by a separator, e.g., `c:\windows` but not `c:windows`
    ///     * has any non-disk prefix, e.g., `\\server\share`
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::Path;
    ///
    /// assert!(Path::new("/etc/passwd").has_root());
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    #[inline]
    pub fn has_root(&self) -> bool {
        self.components().has_root()
    }

    /// Returns the `Path` without its final component, if there is one.
    ///
    /// This means it returns `Some("")` for relative paths with one component.
    ///
    /// Returns [`None`] if the path terminates in a root or prefix, or if it's
    /// # 示例
    ///
    /// # Examples
    ///
    /// ```
    /// use std::path::Path;
    ///
    /// let path = Path::new("/foo/bar");
    /// let parent = path.parent().unwrap();
    /// assert_eq!(parent, Path::new("/foo"));
    ///
    /// let grand_parent = parent.parent().unwrap();
    /// assert_eq!(grand_parent, Path::new("/"));
    /// assert_eq!(grand_parent.parent(), None);
    ///
    /// let relative_path = Path::new("foo/bar");
    /// let parent = relative_path.parent();
    /// assert_eq!(parent, Some(Path::new("foo")));
    /// let grand_parent = parent.and_then(Path::parent);
    /// assert_eq!(grand_parent, Some(Path::new("")));
    /// let great_grand_parent = grand_parent.and_then(Path::parent);
    /// assert_eq!(great_grand_parent, None);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[doc(alias = "dirname")]
    #[must_use]
    pub fn parent(&self) -> Option<&Path> {
        let mut comps = self.components();
        let comp = comps.next_back();
        comp.and_then(|p| match p {
            Component::Normal(_) | Component::CurDir | Component::ParentDir => {
                Some(comps.as_path())
            }
            _ => None,
        })
    }

    /// Produces an iterator over `Path` and its ancestors.
    ///
    /// The iterator will yield the `Path` that is returned if the [`parent`] method is used zero
    /// or more times. If the [`parent`] method returns [`None`], the iterator will do likewise.
    /// The iterator will always yield at least one value, namely `Some(&self)`. Next it will yield
    /// `&self.parent()`, `&self.parent().and_then(Path::parent)` and so on.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::Path;
    ///
    /// let mut ancestors = Path::new("/foo/bar").ancestors();
    /// assert_eq!(ancestors.next(), Some(Path::new("/foo/bar")));
    /// assert_eq!(ancestors.next(), Some(Path::new("/foo")));
    /// assert_eq!(ancestors.next(), Some(Path::new("/")));
    /// assert_eq!(ancestors.next(), None);
    ///
    /// let mut ancestors = Path::new("../foo/bar").ancestors();
    /// assert_eq!(ancestors.next(), Some(Path::new("../foo/bar")));
    /// assert_eq!(ancestors.next(), Some(Path::new("../foo")));
    /// assert_eq!(ancestors.next(), Some(Path::new("..")));
    /// assert_eq!(ancestors.next(), Some(Path::new("")));
    /// assert_eq!(ancestors.next(), None);
    /// ```
    ///
    /// [`parent`]: Path::parent
    #[stable(feature = "path_ancestors", since = "1.28.0")]
    #[inline]
    pub fn ancestors(&self) -> Ancestors<'_> {
        Ancestors { next: Some(self) }
    }

    /// Returns the final component of the `Path`, if there is one.
    ///
    /// 如果路径是一个普通文件，则这是文件名。如果路径是一个目录，则这是
    /// 目录名。
    ///
    /// Returns [`None`] if the path terminates in `..`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::Path;
    /// use std::ffi::OsStr;
    ///
    /// assert_eq!(Some(OsStr::new("bin")), Path::new("/usr/bin/").file_name());
    /// assert_eq!(Some(OsStr::new("foo.txt")), Path::new("tmp/foo.txt").file_name());
    /// assert_eq!(Some(OsStr::new("foo.txt")), Path::new("foo.txt/.").file_name());
    /// assert_eq!(Some(OsStr::new("foo.txt")), Path::new("foo.txt/.//").file_name());
    /// assert_eq!(None, Path::new("foo.txt/..").file_name());
    /// assert_eq!(None, Path::new("/").file_name());
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[doc(alias = "basename")]
    #[must_use]
    pub fn file_name(&self) -> Option<&OsStr> {
        self.components().next_back().and_then(|p| match p {
            Component::Normal(p) => Some(p),
            _ => None,
        })
    }

    /// Returns a path that, when joined onto `base`, yields `self`.
    ///
    /// # 错误
    ///
    /// If `base` is not a prefix of `self` (i.e., [`starts_with`]
    /// returns `false`), returns [`Err`].
    ///
    /// [`starts_with`]: Path::starts_with
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::{Path, PathBuf};
    ///
    /// let path = Path::new("/test/haha/foo.txt");
    ///
    /// assert_eq!(path.strip_prefix("/"), Ok(Path::new("test/haha/foo.txt")));
    /// assert_eq!(path.strip_prefix("/test"), Ok(Path::new("haha/foo.txt")));
    /// assert_eq!(path.strip_prefix("/test/"), Ok(Path::new("haha/foo.txt")));
    /// assert_eq!(path.strip_prefix("/test/haha/foo.txt"), Ok(Path::new("")));
    /// assert_eq!(path.strip_prefix("/test/haha/foo.txt/"), Ok(Path::new("")));
    ///
    /// assert!(path.strip_prefix("test").is_err());
    /// assert!(path.strip_prefix("/te").is_err());
    /// assert!(path.strip_prefix("/haha").is_err());
    ///
    /// let prefix = PathBuf::from("/test/");
    /// assert_eq!(path.strip_prefix(prefix), Ok(Path::new("haha/foo.txt")));
    /// ```
    #[stable(since = "1.7.0", feature = "path_strip_prefix")]
    pub fn strip_prefix<P>(&self, base: P) -> Result<&Path, StripPrefixError>
    where
        P: AsRef<Path>,
    {
        self._strip_prefix(base.as_ref())
    }

    /// 返回去除可选前缀后的路径。
    ///
    /// If `base` is not a prefix of `self` (i.e., [`starts_with`] returns `false`), returns the original path (`self`)
    ///
    /// [`starts_with`]: Path::starts_with
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::Path;
    ///
    /// let path = Path::new("/test/haha/foo.txt");
    ///
    /// // Prefix present - remove it
    /// assert_eq!(path.trim_prefix("/"), Path::new("test/haha/foo.txt"));
    /// assert_eq!(path.trim_prefix("/test"), Path::new("haha/foo.txt"));
    /// assert_eq!(path.trim_prefix("/test/"), Path::new("haha/foo.txt"));
    /// assert_eq!(path.trim_prefix("/test/haha/foo.txt"), Path::new(""));
    /// assert_eq!(path.trim_prefix("/test/haha/foo.txt/"), Path::new(""));
    ///
    /// // Prefix absent - return original
    /// assert_eq!(path.trim_prefix("test"), path);
    /// assert_eq!(path.trim_prefix("/te"), path);
    /// assert_eq!(path.trim_prefix("/haha"), path);
    /// ```
    #[must_use = "this returns the remaining path as a new path, without modifying the original"]
    #[stable(feature = "trim_prefix_suffix", since = "1.100.0")]
    pub fn trim_prefix<P>(&self, base: P) -> &Path
    where
        P: AsRef<Path>,
    {
        self._strip_prefix(base.as_ref()).unwrap_or(self)
    }

    fn _strip_prefix(&self, base: &Path) -> Result<&Path, StripPrefixError> {
        iter_after(self.components(), base.components())
            .map(|c| c.as_path())
            .ok_or(StripPrefixError(()))
    }

    /// Determines whether `base` is a prefix of `self`.
    ///
    /// 仅考虑整个路径组件是否匹配。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::Path;
    ///
    /// let path = Path::new("/etc/passwd");
    ///
    /// assert!(path.starts_with("/etc"));
    /// assert!(path.starts_with("/etc/"));
    /// assert!(path.starts_with("/etc/passwd"));
    /// assert!(path.starts_with("/etc/passwd/")); // extra slash is okay
    /// assert!(path.starts_with("/etc/passwd///")); // multiple extra slashes are okay
    ///
    /// assert!(!path.starts_with("/e"));
    /// assert!(!path.starts_with("/etc/passwd.txt"));
    ///
    /// assert!(!Path::new("/etc/foo.rs").starts_with("/etc/foo"));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    pub fn starts_with<P: AsRef<Path>>(&self, base: P) -> bool {
        self._starts_with(base.as_ref())
    }

    fn _starts_with(&self, base: &Path) -> bool {
        iter_after(self.components(), base.components()).is_some()
    }

    /// Determines whether `child` is a suffix of `self`.
    ///
    /// 仅考虑整个路径组件是否匹配。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::Path;
    ///
    /// let path = Path::new("/etc/resolv.conf");
    ///
    /// assert!(path.ends_with("resolv.conf"));
    /// assert!(path.ends_with("etc/resolv.conf"));
    /// assert!(path.ends_with("/etc/resolv.conf"));
    ///
    /// assert!(!path.ends_with("/resolv.conf"));
    /// assert!(!path.ends_with("conf")); // use .extension() instead
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    pub fn ends_with<P: AsRef<Path>>(&self, child: P) -> bool {
        self._ends_with(child.as_ref())
    }

    fn _ends_with(&self, child: &Path) -> bool {
        iter_after(self.components().rev(), child.components().rev()).is_some()
    }

    /// Checks whether the `Path` is empty.
    ///
    /// 向大多数操作系统文件系统 API 传递空路径总是会引发错误。
    ///
    /// 将空路径 [push] 到现有路径后，除非该路径已以分隔符结尾或为空，否则会添加目录分隔符。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::Path;
    ///
    /// let path = Path::new("");
    /// assert!(path.is_empty());
    ///
    /// let path = Path::new("foo");
    /// assert!(!path.is_empty());
    ///
    /// let path = Path::new(".");
    /// assert!(!path.is_empty());
    /// ```
    #[stable(feature = "path_is_empty", since = "1.98.0")]
    pub fn is_empty(&self) -> bool {
        self.as_os_str().is_empty()
    }

    /// Extracts the stem (non-extension) portion of [`self.file_name`].
    ///
    /// [`self.file_name`]: Path::file_name
    ///
    /// 主干为：
    ///
    /// * [`None`], if there is no file name;
    /// * The entire file name if there is no embedded `.`;
    /// * The entire file name if the file name begins with `.` and has no other `.`s within;
    /// * Otherwise, the portion of the file name before the final `.`
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::Path;
    ///
    /// assert_eq!("foo", Path::new("foo.rs").file_stem().unwrap());
    /// assert_eq!("foo.tar", Path::new("foo.tar.gz").file_stem().unwrap());
    /// ```
    ///
    /// # 另见
    /// This method is similar to [`Path::file_prefix`], which extracts the portion of the file name
    /// before the *first* `.`
    ///
    /// [`Path::file_prefix`]: Path::file_prefix
    ///
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    pub fn file_stem(&self) -> Option<&OsStr> {
        self.file_name().map(rsplit_file_at_dot).and_then(|(before, after)| before.or(after))
    }

    /// Extracts the prefix of [`self.file_name`].
    ///
    /// 前缀为：
    ///
    /// * [`None`], if there is no file name;
    /// * The entire file name if there is no embedded `.`;
    /// * The portion of the file name before the first non-beginning `.`;
    /// * The entire file name if the file name begins with `.` and has no other `.`s within;
    /// * The portion of the file name before the second `.` if the file name begins with `.`
    ///
    /// [`self.file_name`]: Path::file_name
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::Path;
    ///
    /// assert_eq!("foo", Path::new("foo.rs").file_prefix().unwrap());
    /// assert_eq!("foo", Path::new("foo.tar.gz").file_prefix().unwrap());
    /// assert_eq!(".config", Path::new(".config").file_prefix().unwrap());
    /// assert_eq!(".config", Path::new(".config.toml").file_prefix().unwrap());
    /// ```
    ///
    /// # 另见
    /// This method is similar to [`Path::file_stem`], which extracts the portion of the file name
    /// before the *last* `.`
    ///
    /// [`Path::file_stem`]: Path::file_stem
    ///
    #[stable(feature = "path_file_prefix", since = "1.91.0")]
    #[must_use]
    pub fn file_prefix(&self) -> Option<&OsStr> {
        self.file_name().map(split_file_at_dot).map(|(before, _after)| before)
    }

    /// Extracts the extension (without the leading dot) of [`self.file_name`], if possible.
    ///
    /// 扩展名为：
    ///
    /// * [`None`], if there is no file name;
    /// * [`None`], if there is no embedded `.`;
    /// * [`None`], if the file name begins with `.` and has no other `.`s within;
    /// * Otherwise, the portion of the file name after the final `.`
    ///
    /// [`self.file_name`]: Path::file_name
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::Path;
    ///
    /// assert_eq!("rs", Path::new("foo.rs").extension().unwrap());
    /// assert_eq!("gz", Path::new("foo.tar.gz").extension().unwrap());
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    pub fn extension(&self) -> Option<&OsStr> {
        self.file_name().map(rsplit_file_at_dot).and_then(|(before, after)| before.and(after))
    }

    /// Checks whether the path ends in a trailing [separator](MAIN_SEPARATOR).
    ///
    /// 通常这样做是为了确保路径被视为目录而非文件。
    /// 尽管实际上并不保证这样的路径在底层文件系统中是一个目录。
    /// 即使有这种行为，在 Rust 中两条路径如果都带有
    ///
    /// 无论是否带有尾随分隔符，都被视为相同的路径。
    /// # 示例
    ///
    /// # 确保路径具有尾随的[分隔符]，并在必要时分配[内存]。
    ///
    /// ```
    /// #![feature(path_trailing_sep)]
    /// use std::path::Path;
    ///
    /// assert!(Path::new("dir/").has_trailing_sep());
    /// assert!(!Path::new("file.rs").has_trailing_sep());
    /// ```
    #[unstable(feature = "path_trailing_sep", issue = "142503")]
    #[must_use]
    #[inline]
    pub fn has_trailing_sep(&self) -> bool {
        let comps = self.components();
        self.as_os_str().as_encoded_bytes().last().copied().is_some_and(|b| comps.is_sep_byte(b))
    }

    /// Ensures that a path has a trailing [separator](MAIN_SEPARATOR),
    /// allocating a [`PathBuf`] if necessary.
    ///
    /// The resulting path will return true for [`has_trailing_sep`](Self::has_trailing_sep).
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(path_trailing_sep)]
    /// use std::ffi::OsStr;
    /// use std::path::Path;
    ///
    /// assert_eq!(Path::new("dir//").with_trailing_sep().as_os_str(), OsStr::new("dir//"));
    /// assert_eq!(Path::new("dir/").with_trailing_sep().as_os_str(), OsStr::new("dir/"));
    /// assert!(!Path::new("dir").has_trailing_sep());
    /// assert!(Path::new("dir").with_trailing_sep().has_trailing_sep());
    /// ```
    #[unstable(feature = "path_trailing_sep", issue = "142503")]
    #[must_use]
    #[inline]
    pub fn with_trailing_sep(&self) -> Cow<'_, Path> {
        if self.has_trailing_sep() { Cow::Borrowed(self) } else { Cow::Owned(self.join("")) }
    }

    /// Trims a trailing [separator](MAIN_SEPARATOR) from a path, if possible.
    ///
    /// The resulting path will return false for [`has_trailing_sep`](Self::has_trailing_sep) for
    /// most paths.
    ///
    /// Some paths, like `/`, cannot be trimmed in this way.
    ///
    /// # Examples
    ///
    /// ```
    /// #![feature(path_trailing_sep)]
    /// use std::ffi::OsStr;
    /// use std::path::Path;
    ///
    /// assert_eq!(Path::new("dir//").trim_trailing_sep().as_os_str(), OsStr::new("dir"));
    /// assert_eq!(Path::new("dir/").trim_trailing_sep().as_os_str(), OsStr::new("dir"));
    /// assert_eq!(Path::new("dir").trim_trailing_sep().as_os_str(), OsStr::new("dir"));
    /// assert_eq!(Path::new("/").trim_trailing_sep().as_os_str(), OsStr::new("/"));
    /// assert_eq!(Path::new("//").trim_trailing_sep().as_os_str(), OsStr::new("//"));
    /// ```
    #[unstable(feature = "path_trailing_sep", issue = "142503")]
    #[must_use]
    #[inline]
    pub fn trim_trailing_sep(&self) -> &Path {
        let comps = self.components();
        if self.has_trailing_sep() && (!self.has_root() || self.parent().is_some()) {
            let mut bytes = self.inner.as_encoded_bytes();
            while let Some((last, init)) = bytes.split_last()
                && comps.is_sep_byte(*last)
            {
                bytes = init;
            }

            // SAFETY: Trimming trailing ASCII bytes will retain the validity of the string.
            Path::new(unsafe { OsStr::from_encoded_bytes_unchecked(bytes) })
        } else {
            self
        }
    }

    /// Creates an owned [`PathBuf`] with `path` adjoined to `self`.
    ///
    /// If `path` is absolute, it replaces the current path.
    ///
    /// 在 Windows 上：
    ///
    /// * if `path` has a root but no prefix (e.g., `\windows`), it
    ///   replaces and returns everything except for the prefix (if any) of `self`.
    /// * if `path` has a prefix but no root, `self` is ignored and `path` is returned.
    /// * if `self` has a verbatim prefix (e.g. `\\?\C:\windows`)
    ///   and `path` is not empty, the new path is normalized: all references
    ///   to `.` and `..` are removed.
    ///
    /// See [`PathBuf::push`] for more details on what it means to adjoin a path.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::{Path, PathBuf};
    ///
    /// assert_eq!(Path::new("/etc").join("passwd"), PathBuf::from("/etc/passwd"));
    /// assert_eq!(Path::new("/etc").join("/bin/sh"), PathBuf::from("/bin/sh"));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    pub fn join<P: AsRef<Path>>(&self, path: P) -> PathBuf {
        self._join(path.as_ref())
    }

    fn _join(&self, path: &Path) -> PathBuf {
        let mut buf = self.to_path_buf();
        buf.push(path);
        buf
    }

    /// Creates an owned [`PathBuf`] like `self` but with the given file name.
    ///
    /// See [`PathBuf::set_file_name`] for more details.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::{Path, PathBuf};
    ///
    /// let path = Path::new("/tmp/foo.png");
    /// assert_eq!(path.with_file_name("bar"), PathBuf::from("/tmp/bar"));
    /// assert_eq!(path.with_file_name("bar.txt"), PathBuf::from("/tmp/bar.txt"));
    ///
    /// let path = Path::new("/tmp");
    /// assert_eq!(path.with_file_name("var"), PathBuf::from("/var"));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    pub fn with_file_name<S: AsRef<OsStr>>(&self, file_name: S) -> PathBuf {
        self._with_file_name(file_name.as_ref())
    }

    fn _with_file_name(&self, file_name: &OsStr) -> PathBuf {
        let mut buf = self.to_path_buf();
        buf.set_file_name(file_name);
        buf
    }

    /// Creates an owned [`PathBuf`] like `self` but with the given extension.
    ///
    /// See [`PathBuf::set_extension`] for more details.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::Path;
    ///
    /// let path = Path::new("foo.rs");
    /// assert_eq!(path.with_extension("txt"), Path::new("foo.txt"));
    /// assert_eq!(path.with_extension(""), Path::new("foo"));
    /// ```
    ///
    /// 处理多个扩展名：
    ///
    /// ```
    /// use std::path::Path;
    ///
    /// let path = Path::new("foo.tar.gz");
    /// assert_eq!(path.with_extension("xz"), Path::new("foo.tar.xz"));
    /// assert_eq!(path.with_extension("").with_extension("txt"), Path::new("foo.txt"));
    /// ```
    ///
    /// 在不存在扩展名的地方添加扩展名：
    ///
    /// ```
    /// use std::path::Path;
    ///
    /// let path = Path::new("foo");
    /// assert_eq!(path.with_extension("rs"), Path::new("foo.rs"));
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn with_extension<S: AsRef<OsStr>>(&self, extension: S) -> PathBuf {
        self._with_extension(extension.as_ref())
    }

    fn _with_extension(&self, extension: &OsStr) -> PathBuf {
        let self_len = self.as_os_str().len();
        let self_bytes = self.as_os_str().as_encoded_bytes();

        let (new_capacity, slice_to_copy) = match self.extension() {
            None => {
                // Enough capacity for the extension and the dot
                let capacity = self_len + extension.len() + 1;
                let whole_path = self_bytes;
                (capacity, whole_path)
            }
            Some(previous_extension) => {
                let capacity = self_len + extension.len() - previous_extension.len();
                let path_till_dot = &self_bytes[..self_len - previous_extension.len()];
                (capacity, path_till_dot)
            }
        };

        let mut new_path = PathBuf::with_capacity(new_capacity);
        // SAFETY: The path is empty, so cannot have surrogate halves.
        unsafe { new_path.inner.extend_from_slice_unchecked(slice_to_copy) };
        new_path.set_extension(extension);
        new_path
    }

    /// Creates an owned [`PathBuf`] like `self` but with the extension added.
    ///
    /// See [`PathBuf::add_extension`] for more details. The return value of
    /// [`PathBuf::add_extension`] is ignored, which means no extension
    /// will be added to paths with no [`Path::file_name`].
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::{Path, PathBuf};
    ///
    /// let path = Path::new("foo.rs");
    /// assert_eq!(path.with_added_extension("txt"), PathBuf::from("foo.rs.txt"));
    ///
    /// let path = Path::new("foo.tar.gz");
    /// assert_eq!(path.with_added_extension(""), PathBuf::from("foo.tar.gz"));
    /// assert_eq!(path.with_added_extension("xz"), PathBuf::from("foo.tar.gz.xz"));
    /// assert_eq!(path.with_added_extension("").with_added_extension("txt"), PathBuf::from("foo.tar.gz.txt"));
    ///
    /// let path = Path::new("/");
    /// assert_eq!(path.with_added_extension("gz"), PathBuf::from("/"));
    /// let path = Path::new("/dir/");
    /// assert_eq!(path.with_added_extension("gz"), PathBuf::from("/dir.gz"));
    /// let path = Path::new("/dir/..");
    /// assert_eq!(path.with_added_extension("gz"), PathBuf::from("/dir/.."));
    /// ```
    #[stable(feature = "path_add_extension", since = "1.91.0")]
    pub fn with_added_extension<S: AsRef<OsStr>>(&self, extension: S) -> PathBuf {
        let mut new_path = self.to_path_buf();
        new_path.add_extension(extension);
        new_path
    }

    /// Produces an iterator over the [`Component`]s of the path.
    ///
    /// 在解析路径时，会进行少量规范化处理：
    ///
    /// * Repeated separators are ignored, so `a/b` and `a//b` both have
    ///   `a` and `b` as components.
    ///
    /// * Occurrences of `.` are normalized away, except if they are at the
    ///   beginning of the path. For example, `a/./b`, `a/b/`, `a/b/.` and
    ///   `a/b` all have `a` and `b` as components, but `./a/b` starts with
    ///   an additional [`CurDir`] component.
    ///
    /// * Trailing separators are normalized away, so `/a/b` and `/a/b/` are equivalent.
    ///
    /// Note that no other normalization takes place; in particular, `a/c`
    /// and `a/b/../c` are distinct, to account for the possibility that `b`
    /// is a symbolic link (so its parent isn't `a`).
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::{Path, Component};
    /// use std::ffi::OsStr;
    ///
    /// let mut components = Path::new("/tmp/foo.txt").components();
    ///
    /// assert_eq!(components.next(), Some(Component::RootDir));
    /// assert_eq!(components.next(), Some(Component::Normal(OsStr::new("tmp"))));
    /// assert_eq!(components.next(), Some(Component::Normal(OsStr::new("foo.txt"))));
    /// assert_eq!(components.next(), None)
    /// ```
    ///
    /// [`CurDir`]: Component::CurDir
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn components(&self) -> Components<'_> {
        let prefix = parse_prefix(self.as_os_str());
        Components {
            path: self.as_u8_slice(),
            prefix,
            has_physical_root: has_physical_root(self.as_u8_slice(), prefix),
            // use a platform-specific initial state to avoid one turn of
            // the state-machine when the platform doesn't have a Prefix.
            front: const { if HAS_PREFIXES { State::Prefix } else { State::StartDir } },
            back: State::Body,
        }
    }

    /// Produces an iterator over the path's components viewed as [`OsStr`]
    /// 切片。
    ///
    /// For more information about the particulars of how the path is separated
    /// into components, see [`components`].
    ///
    /// [`components`]: Path::components
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::{self, Path};
    /// use std::ffi::OsStr;
    ///
    /// let mut it = Path::new("/tmp/foo.txt").iter();
    /// assert_eq!(it.next(), Some(OsStr::new(&path::MAIN_SEPARATOR.to_string())));
    /// assert_eq!(it.next(), Some(OsStr::new("tmp")));
    /// assert_eq!(it.next(), Some(OsStr::new("foo.txt")));
    /// assert_eq!(it.next(), None)
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn iter(&self) -> Iter<'_> {
        Iter { inner: self.components() }
    }

    /// Returns an object that implements [`Display`] for safely printing paths
    /// 此功能可能会进行有损转换，
    /// 取决于平台。如果您需要一种实现，
    /// escapes the path please use [`Debug`] instead.
    ///
    /// [`Display`]: fmt::Display
    /// [`Debug`]: fmt::Debug
    ///
    /// # 示例
    ///
    /// ```
    /// use std::path::Path;
    ///
    /// let path = Path::new("/tmp/foo.rs");
    ///
    /// println!("{}", path.display());
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use = "this does not display the path, \
                  it returns an object that can be displayed"]
    #[inline]
    pub fn display(&self) -> Display<'_> {
        Display { inner: self.inner.display() }
    }

    /// Returns the same path as `&Path`.
    ///
    /// This method is redundant when used directly on `&Path`, but
    /// it helps dereferencing other `PathBuf`-like types to `Path`s,
    /// for example references to `Box<Path>` or `Arc<Path>`.
    #[inline]
    #[unstable(feature = "str_as_str", issue = "130366")]
    pub const fn as_path(&self) -> &Path {
        self
    }

    /// 查询文件系统以获取文件、目录等的信息。
    ///
    /// 此函数会遍历符号链接以查询目标文件的信息。
    /// destination file.
    ///
    /// This is an alias to [`fs::metadata`].
    ///
    /// # 查询文件的元数据，而不跟随符号链接。
    ///
    /// ```no_run
    /// use std::path::Path;
    ///
    /// let path = Path::new("/Minas/tirith");
    /// let metadata = path.metadata().expect("the path should point to an existing file or directory");
    /// println!("{:?}", metadata.file_type());
    /// ```
    #[stable(feature = "path_ext", since = "1.5.0")]
    #[inline]
    pub fn metadata(&self) -> io::Result<fs::Metadata> {
        fs::metadata(self)
    }

    /// Queries the metadata about a file without following symlinks.
    ///
    /// This is an alias to [`fs::symlink_metadata`].
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::path::Path;
    ///
    /// let path = Path::new("/Minas/tirith");
    /// let metadata = path.symlink_metadata().expect("the path should exist");
    /// println!("{:?}", metadata.file_type());
    /// ```
    #[stable(feature = "path_ext", since = "1.5.0")]
    #[inline]
    pub fn symlink_metadata(&self) -> io::Result<fs::Metadata> {
        fs::symlink_metadata(self)
    }

    /// 返回路径的规范、绝对形式，所有中间组件已标准化，符号链接已解析。
    /// components normalized and symbolic links resolved.
    ///
    /// This is an alias to [`fs::canonicalize`].
    ///
    /// # 错误
    ///
    /// 此函数在以下情况下会返回错误，但不仅限于这些情况：
    /// limited to just these cases:
    ///
    /// * `path` does not exist.
    /// # 示例
    ///
    /// # 使路径绝对化而不访问文件系统。
    ///
    /// ```no_run
    /// use std::path::{Path, PathBuf};
    ///
    /// let path = Path::new("/foo/test/../test/bar.rs");
    /// assert_eq!(path.canonicalize().unwrap(), PathBuf::from("/foo/test/bar.rs"));
    /// ```
    #[stable(feature = "path_ext", since = "1.5.0")]
    #[inline]
    pub fn canonicalize(&self) -> io::Result<PathBuf> {
        fs::canonicalize(self)
    }

    /// Makes the path absolute without accessing the filesystem.
    ///
    /// This is an alias to [`path::absolute`](absolute).
    ///
    /// # 错误
    ///
    /// 此函数可能在以下情况下返回错误：
    ///
    /// * 如果路径在语法上无效；特别是如果它是空的。
    /// * 如果获取 [当前目录][crate::env::current_dir] 失败。
    ///
    /// # 示例
    ///
    /// ```no_run
    /// #![feature(path_absolute_method)]
    /// use std::path::Path;
    ///
    /// let path = Path::new("foo/./bar");
    /// let absolute = path.absolute()?;
    /// assert!(absolute.is_absolute());
    /// # Ok::<(), std::io::Error>(())
    /// ```
    #[unstable(feature = "path_absolute_method", issue = "153328")]
    #[inline]
    pub fn absolute(&self) -> io::Result<PathBuf> {
        absolute(self)
    }

    /// Normalize a path, including `..` without traversing the filesystem.
    ///
    /// Returns an error if normalization would leave leading `..` components.
    ///
    /// <div class="warning">
    ///
    /// This function always resolves `..` to the "lexical" parent.
    /// That is "a/b/../c" will always resolve to `a/c` which can change the meaning of the path.
    /// In particular, `a/c` and `a/b/../c` are distinct on many systems because `b` may be a symbolic link, so its parent isn't `a`.
    ///
    /// </div>
    ///
    /// On Windows this will convert all `/` to `\` unless a [verbatim](Prefix::is_verbatim()) path is given.
    ///
    /// [`path::absolute`](absolute) is an alternative that preserves `..`.
    /// Or [`Path::canonicalize`] can be used to resolve any `..` by querying the filesystem.
    #[unstable(feature = "normalize_lexically", issue = "134694")]
    pub fn normalize_lexically(&self) -> Result<PathBuf, NormalizeError> {
        let mut lexical = PathBuf::new();
        let mut iter = self.components().peekable();

        // Find the root, if any, and add it to the lexical path.
        // Here we treat the Windows path "C:\" as a single "root" even though
        // `components` splits it into two: (Prefix, RootDir).
        let root = match iter.peek() {
            Some(Component::ParentDir) => return Err(NormalizeError),
            Some(p @ Component::RootDir) | Some(p @ Component::CurDir) => {
                lexical.push(p);
                iter.next();
                lexical.as_os_str().len()
            }
            Some(Component::Prefix(prefix)) => {
                lexical.push(prefix.as_os_str());
                iter.next();
                if let Some(p @ Component::RootDir) = iter.peek() {
                    lexical.push(p);
                    iter.next();
                }
                lexical.as_os_str().len()
            }
            None => return Ok(PathBuf::new()),
            Some(Component::Normal(_)) => 0,
        };

        for component in iter {
            match component {
                Component::RootDir => unreachable!(),
                Component::Prefix(_) => return Err(NormalizeError),
                Component::CurDir => continue,
                Component::ParentDir => {
                    // It's an error if ParentDir causes us to go above the "root".
                    if lexical.as_os_str().len() == root {
                        return Err(NormalizeError);
                    } else {
                        lexical.pop();
                    }
                }
                Component::Normal(path) => lexical.push(path),
            }
        }
        Ok(lexical)
    }

    /// 读取符号链接，返回链接指向的文件。
    ///
    /// This is an alias to [`fs::read_link`].
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::path::Path;
    ///
    /// let path = Path::new("/laputa/sky_castle.rs");
    /// let path_link = path.read_link().expect("the path should be an existing symbolic link");
    /// ```
    #[stable(feature = "path_ext", since = "1.5.0")]
    #[inline]
    pub fn read_link(&self) -> io::Result<PathBuf> {
        fs::read_link(self)
    }

    /// 返回一个目录中条目的迭代器。
    ///
    /// The iterator will yield instances of <code>[io::Result]<[fs::DirEntry]></code>. New
    /// 在初始构建迭代器后可能会遇到错误。
    ///
    /// This is an alias to [`fs::read_dir`].
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::path::Path;
    ///
    /// let path = Path::new("/laputa");
    /// for entry in path.read_dir().expect("the path should point to an existing directory") {
    ///     if let Ok(entry) = entry {
    ///         println!("{:?}", entry.path());
    ///     }
    /// }
    /// ```
    #[stable(feature = "path_ext", since = "1.5.0")]
    #[inline]
    pub fn read_dir(&self) -> io::Result<fs::ReadDir> {
        fs::read_dir(self)
    }

    /// Returns `true` if the path points at an existing entity.
    ///
    /// Warning: this method may be error-prone, consider using [`try_exists()`] instead!
    /// 它还有引入时间检查到使用时间错误 ([TOCTOU]) 的风险。
    ///
    /// 此函数将遍历符号链接以查询关于
    /// 目标文件的信息。
    ///
    /// 如果您无法访问文件的元数据，例如由于
    /// permission error or broken symbolic links, this will return `false`.
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::path::Path;
    /// assert!(!Path::new("does_not_exist.txt").exists());
    /// ```
    ///
    /// # 另见
    ///
    /// 这是一个将错误转换为 false 的便捷函数。如果您想
    /// check errors, call [`Path::try_exists`].
    ///
    /// [`try_exists()`]: Self::try_exists
    /// [TOCTOU]: fs#time-of-check-to-time-of-use-toctou
    #[stable(feature = "path_ext", since = "1.5.0")]
    #[must_use]
    #[inline]
    pub fn exists(&self) -> bool {
        fs::metadata(self).is_ok()
    }

    /// Returns `Ok(true)` if the path points at an existing entity.
    ///
    /// 此函数将遍历符号链接以查询关于
    /// destination file. In case of broken symbolic links this will return `Ok(false)`.
    ///
    /// [`Path::exists()`] only checks whether or not a path was both found and readable. By
    /// contrast, `try_exists` will return `Ok(true)` or `Ok(false)`, respectively, if the path
    /// 被 _验证_ 存在或不存在。如果其存在性无法确认或
    /// denied, it will propagate an `Err(_)` instead. This can be the case if e.g. listing
    /// 父目录中的某个目录被拒绝访问时，就会出现这种情况。
    ///
    /// Note that while this avoids some pitfalls of the `exists()` method, it still can not
    /// 防止时间检查到使用时间错误 ([TOCTOU]) 错误。您只应在那些错误不是问题的场景中使用它。
    /// where those bugs are not an issue.
    ///
    /// This is an alias for [`std::fs::exists`](crate::fs::exists).
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::path::Path;
    /// assert!(!Path::new("does_not_exist.txt").try_exists().expect("the path's existence should be verifiable"));
    /// assert!(Path::new("/root/secret_file.txt").try_exists().is_err());
    /// ```
    ///
    /// [TOCTOU]: fs#time-of-check-to-time-of-use-toctou
    /// [`exists()`]: Self::exists
    #[stable(feature = "path_try_exists", since = "1.63.0")]
    #[inline]
    pub fn try_exists(&self) -> io::Result<bool> {
        fs::exists(self)
    }

    /// Returns `true` if the path exists on disk and is pointing at a regular file.
    ///
    /// 此函数将遍历符号链接以查询关于
    /// 目标文件的信息。
    ///
    /// 如果您无法访问文件的元数据，例如由于
    /// permission error or broken symbolic links, this will return `false`.
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::path::Path;
    /// assert_eq!(Path::new("./is_a_directory/").is_file(), false);
    /// assert_eq!(Path::new("a_file.txt").is_file(), true);
    /// ```
    ///
    /// # 另见
    ///
    /// 这是一个便捷函数，可将错误转换为 false。如果您想
    /// check errors, call [`fs::metadata`] and handle its [`Result`]. Then call
    /// [`fs::Metadata::is_file`] if it was [`Ok`].
    ///
    /// 当目标只是读取（或写入）源文件时，测试源文件最
    /// reliable way to test the source can be read (or written to) is to open
    /// it. Only using `is_file` can break workflows like `diff <( prog_a )` on
    /// a Unix-like system for example. See [`fs::File::open`] or
    /// [`fs::OpenOptions::open`] for more information.
    #[stable(feature = "path_ext", since = "1.5.0")]
    #[must_use]
    pub fn is_file(&self) -> bool {
        fs::metadata(self).map(|m| m.is_file()).unwrap_or(false)
    }

    /// Returns `true` if the path exists on disk and is pointing at a directory.
    ///
    /// 此函数会遍历符号链接以查询目标文件的信息。
    /// 如果无法访问文件的元数据，例如由于
    ///
    /// If you cannot access the metadata of the file, e.g. because of a
    /// permission error or broken symbolic links, this will return `false`.
    ///
    /// # 另见
    ///
    /// ```no_run
    /// use std::path::Path;
    /// assert_eq!(Path::new("./is_a_directory/").is_dir(), true);
    /// assert_eq!(Path::new("a_file.txt").is_dir(), false);
    /// ```
    ///
    /// # 另见
    ///
    /// 这是一个便捷函数，可将错误转换为 false。如果您想
    /// check errors, call [`fs::metadata`] and handle its [`Result`]. Then call
    /// [`fs::Metadata::is_dir`] if it was [`Ok`].
    #[stable(feature = "path_ext", since = "1.5.0")]
    #[must_use]
    pub fn is_dir(&self) -> bool {
        fs::metadata(self).map(|m| m.is_dir()).unwrap_or(false)
    }

    /// Returns `true` if the path exists on disk and is pointing at a symbolic link.
    ///
    /// 此函数不会遍历符号链接。
    /// 对于损坏的符号链接，也会返回 true。
    ///
    /// 如果无法访问包含文件的目录，例如由于
    /// 权限错误，此时将返回 false。
    ///
    /// # 示例
    ///
    /// ```rust,no_run
    /// # #[cfg(unix)] {
    /// use std::path::Path;
    /// use std::os::unix::fs::symlink;
    ///
    /// let link_path = Path::new("link");
    /// symlink("/origin_does_not_exist/", link_path).unwrap();
    /// assert_eq!(link_path.is_symlink(), true);
    /// assert_eq!(link_path.exists(), false);
    /// # }
    /// ```
    ///
    /// # 另见
    ///
    /// 这是一个便捷函数，可将错误转换为 false。如果您想
    /// check errors, call [`fs::symlink_metadata`] and handle its [`Result`]. Then call
    /// [`fs::Metadata::is_symlink`] if it was [`Ok`].
    #[must_use]
    #[stable(feature = "is_symlink", since = "1.58.0")]
    pub fn is_symlink(&self) -> bool {
        fs::symlink_metadata(self).map(|m| m.is_symlink()).unwrap_or(false)
    }

    /// Converts a [`Box<Path>`](Box) into a [`PathBuf`] without copying or
    /// 分配内存。
    #[stable(feature = "into_boxed_path", since = "1.20.0")]
    #[must_use = "`self` will be dropped if the result is not used"]
    pub fn into_path_buf(self: Box<Self>) -> PathBuf {
        let rw = Box::into_raw(self) as *mut OsStr;
        let inner = unsafe { Box::from_raw(rw) };
        PathBuf { inner: OsString::from(inner) }
    }
}

#[unstable(feature = "clone_to_uninit", issue = "126799")]
unsafe impl CloneToUninit for Path {
    #[inline]
    #[cfg_attr(debug_assertions, track_caller)]
    unsafe fn clone_to_uninit(&self, dst: *mut u8) {
        // SAFETY: Path is just a transparent wrapper around OsStr
        unsafe { self.inner.clone_to_uninit(dst) }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl AsRef<OsStr> for Path {
    #[inline]
    fn as_ref(&self) -> &OsStr {
        &self.inner
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl fmt::Debug for Path {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Debug::fmt(&self.inner, formatter)
    }
}

/// Helper struct for safely printing paths with [`format!`] and `{}`.
///
/// A [`Path`] might contain non-Unicode data. This `struct` implements the
/// [`Display`] trait in a way that mitigates that. It is created by the
/// [`display`](Path::display) method on [`Path`]. This may perform lossy
/// 转换。如果您希望实现
/// which escapes the path please use [`Debug`] instead.
///
/// # 示例
///
/// ```
/// use std::path::Path;
///
/// let path = Path::new("/tmp/foo.rs");
///
/// println!("{}", path.display());
/// ```
///
/// [`Display`]: fmt::Display
/// [`format!`]: crate::format
#[stable(feature = "rust1", since = "1.0.0")]
pub struct Display<'a> {
    inner: os_str::Display<'a>,
}

#[stable(feature = "rust1", since = "1.0.0")]
impl fmt::Debug for Display<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Debug::fmt(&self.inner, f)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl fmt::Display for Display<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Display::fmt(&self.inner, f)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl PartialEq for Path {
    #[inline]
    fn eq(&self, other: &Path) -> bool {
        self.components() == other.components()
    }
}

#[stable(feature = "eq_str_for_path", since = "1.91.0")]
impl cmp::PartialEq<str> for Path {
    #[inline]
    fn eq(&self, other: &str) -> bool {
        let other: &OsStr = other.as_ref();
        self == other
    }
}

#[stable(feature = "eq_str_for_path", since = "1.91.0")]
impl cmp::PartialEq<Path> for str {
    #[inline]
    fn eq(&self, other: &Path) -> bool {
        other == self
    }
}

#[stable(feature = "eq_str_for_path", since = "1.91.0")]
impl cmp::PartialEq<String> for Path {
    #[inline]
    fn eq(&self, other: &String) -> bool {
        self == other.as_str()
    }
}

#[stable(feature = "eq_str_for_path", since = "1.91.0")]
impl cmp::PartialEq<Path> for String {
    #[inline]
    fn eq(&self, other: &Path) -> bool {
        self.as_str() == other
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Hash for Path {
    fn hash<H: Hasher>(&self, h: &mut H) {
        let bytes = self.as_u8_slice();
        let (prefix_len, verbatim) = match parse_prefix(&self.inner) {
            Some(prefix) => {
                prefix.hash(h);
                (prefix.len(), prefix.is_verbatim())
            }
            None => (0, false),
        };
        let bytes = &bytes[prefix_len..];

        let mut component_start = 0;
        // track some extra state to avoid prefix collisions.
        // ["foo", "bar"] and ["foobar"], will have the same payload bytes
        // but result in different chunk_bits
        let mut chunk_bits: usize = 0;

        for i in 0..bytes.len() {
            let is_sep = if verbatim { is_verbatim_sep(bytes[i]) } else { is_sep_byte(bytes[i]) };
            if is_sep {
                if i > component_start {
                    let to_hash = &bytes[component_start..i];
                    chunk_bits = chunk_bits.wrapping_add(to_hash.len());
                    chunk_bits = chunk_bits.rotate_right(2);
                    h.write(to_hash);
                }

                // skip over separator and optionally a following CurDir item
                // since components() would normalize these away.
                component_start = i + 1;

                let tail = &bytes[component_start..];

                if !verbatim {
                    component_start += match tail {
                        [b'.'] => 1,
                        [b'.', sep, ..] if is_sep_byte(*sep) => 1,
                        _ => 0,
                    };
                }
            }
        }

        if component_start < bytes.len() {
            let to_hash = &bytes[component_start..];
            chunk_bits = chunk_bits.wrapping_add(to_hash.len());
            chunk_bits = chunk_bits.rotate_right(2);
            h.write(to_hash);
        }

        h.write_usize(chunk_bits);
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Eq for Path {}

#[stable(feature = "rust1", since = "1.0.0")]
impl PartialOrd for Path {
    #[inline]
    fn partial_cmp(&self, other: &Path) -> Option<cmp::Ordering> {
        Some(compare_components(self.components(), other.components()))
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl Ord for Path {
    #[inline]
    fn cmp(&self, other: &Path) -> cmp::Ordering {
        compare_components(self.components(), other.components())
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl AsRef<Path> for Path {
    #[inline]
    fn as_ref(&self) -> &Path {
        self
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
const impl AsRef<Path> for OsStr {
    #[inline]
    fn as_ref(&self) -> &Path {
        Path::new(self)
    }
}

#[stable(feature = "cow_os_str_as_ref_path", since = "1.8.0")]
impl AsRef<Path> for Cow<'_, OsStr> {
    #[inline]
    fn as_ref(&self) -> &Path {
        Path::new(self)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl AsRef<Path> for OsString {
    #[inline]
    fn as_ref(&self) -> &Path {
        Path::new(self)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl AsRef<Path> for str {
    #[inline]
    fn as_ref(&self) -> &Path {
        Path::new(self)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl AsRef<Path> for String {
    #[inline]
    fn as_ref(&self) -> &Path {
        Path::new(self)
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl AsRef<Path> for PathBuf {
    #[inline]
    fn as_ref(&self) -> &Path {
        self
    }
}

#[stable(feature = "path_into_iter", since = "1.6.0")]
impl<'a> IntoIterator for &'a PathBuf {
    type Item = &'a OsStr;
    type IntoIter = Iter<'a>;
    #[inline]
    fn into_iter(self) -> Iter<'a> {
        self.iter()
    }
}

#[stable(feature = "path_into_iter", since = "1.6.0")]
impl<'a> IntoIterator for &'a Path {
    type Item = &'a OsStr;
    type IntoIter = Iter<'a>;
    #[inline]
    fn into_iter(self) -> Iter<'a> {
        self.iter()
    }
}

macro_rules! impl_cmp {
    ($lhs:ty, $rhs: ty) => {
        #[stable(feature = "partialeq_path", since = "1.6.0")]
        impl PartialEq<$rhs> for $lhs {
            #[inline]
            fn eq(&self, other: &$rhs) -> bool {
                <Path as PartialEq>::eq(self, other)
            }
        }

        #[stable(feature = "partialeq_path", since = "1.6.0")]
        impl PartialEq<$lhs> for $rhs {
            #[inline]
            fn eq(&self, other: &$lhs) -> bool {
                <Path as PartialEq>::eq(self, other)
            }
        }

        #[stable(feature = "cmp_path", since = "1.8.0")]
        impl PartialOrd<$rhs> for $lhs {
            #[inline]
            fn partial_cmp(&self, other: &$rhs) -> Option<cmp::Ordering> {
                <Path as PartialOrd>::partial_cmp(self, other)
            }
        }

        #[stable(feature = "cmp_path", since = "1.8.0")]
        impl PartialOrd<$lhs> for $rhs {
            #[inline]
            fn partial_cmp(&self, other: &$lhs) -> Option<cmp::Ordering> {
                <Path as PartialOrd>::partial_cmp(self, other)
            }
        }
    };
}

impl_cmp!(PathBuf, Path);
impl_cmp!(PathBuf, &Path);
impl_cmp!(Cow<'_, Path>, Path);
impl_cmp!(Cow<'_, Path>, &Path);
impl_cmp!(Cow<'_, Path>, PathBuf);

macro_rules! impl_cmp_os_str {
    ($lhs:ty, $rhs: ty) => {
        #[stable(feature = "cmp_path", since = "1.8.0")]
        impl PartialEq<$rhs> for $lhs {
            #[inline]
            fn eq(&self, other: &$rhs) -> bool {
                <Path as PartialEq>::eq(self, other.as_ref())
            }
        }

        #[stable(feature = "cmp_path", since = "1.8.0")]
        impl PartialEq<$lhs> for $rhs {
            #[inline]
            fn eq(&self, other: &$lhs) -> bool {
                <Path as PartialEq>::eq(self.as_ref(), other)
            }
        }

        #[stable(feature = "cmp_path", since = "1.8.0")]
        impl PartialOrd<$rhs> for $lhs {
            #[inline]
            fn partial_cmp(&self, other: &$rhs) -> Option<cmp::Ordering> {
                <Path as PartialOrd>::partial_cmp(self, other.as_ref())
            }
        }

        #[stable(feature = "cmp_path", since = "1.8.0")]
        impl PartialOrd<$lhs> for $rhs {
            #[inline]
            fn partial_cmp(&self, other: &$lhs) -> Option<cmp::Ordering> {
                <Path as PartialOrd>::partial_cmp(self.as_ref(), other)
            }
        }
    };
}

impl_cmp_os_str!(PathBuf, OsStr);
impl_cmp_os_str!(PathBuf, &OsStr);
impl_cmp_os_str!(PathBuf, Cow<'_, OsStr>);
impl_cmp_os_str!(PathBuf, OsString);
impl_cmp_os_str!(Path, OsStr);
impl_cmp_os_str!(Path, &OsStr);
impl_cmp_os_str!(Path, Cow<'_, OsStr>);
impl_cmp_os_str!(Path, OsString);
impl_cmp_os_str!(&Path, OsStr);
impl_cmp_os_str!(&Path, Cow<'_, OsStr>);
impl_cmp_os_str!(&Path, OsString);
impl_cmp_os_str!(Cow<'_, Path>, OsStr);
impl_cmp_os_str!(Cow<'_, Path>, &OsStr);
impl_cmp_os_str!(Cow<'_, Path>, OsString);

#[stable(since = "1.7.0", feature = "strip_prefix")]
impl fmt::Display for StripPrefixError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        "prefix not found".fmt(f)
    }
}

#[stable(since = "1.7.0", feature = "strip_prefix")]
impl Error for StripPrefixError {}

#[unstable(feature = "normalize_lexically", issue = "134694")]
impl fmt::Display for NormalizeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("parent reference `..` points outside of base directory")
    }
}
#[unstable(feature = "normalize_lexically", issue = "134694")]
impl Error for NormalizeError {}

/// 使路径绝对化而不访问文件系统。
///
/// 如果路径是相对的，则当前目录作为基础目录使用。
/// 所有中间组件将根据平台特定规则进行解析。
/// rules, but unlike [`canonicalize`][crate::fs::canonicalize], this does not
/// 解析符号链接，即使路径不存在也能成功。
///
/// If the `path` is empty or getting the
/// [当前目录][crate::env::current_dir] 失败，则会返回错误。
/// # 平台特定行为
///
/// # Platform-specific behavior
///
/// 在 POSIX 平台上，路径使用 [POSIX 语义][posix-semantics] 解析，
/// except that it stops short of resolving symlinks. This means it will keep `..`
/// 组件和尾部分隔符。
///
/// 在 Windows 上，对于原样路径，会直接返回给定路径。对于其他
/// 路径，目前相当于调用
/// [`GetFullPathNameW`][windows-path].
///
/// On Cygwin, this is currently equivalent to calling [`cygwin_conv_path`][cygwin-path]
/// with mode `CCP_WIN_A_TO_POSIX`, and then being processed like other POSIX platforms.
/// If a Windows path is given, it will be converted to an absolute POSIX path without
/// keeping `..`.
///
/// Note that these [may change in the future][changes].
///
/// # 错误
///
/// 此函数在以下情况下可能返回错误：
///
/// * If `path` is syntactically invalid; in particular, if it is empty.
/// * 如果获取 [当前目录][crate::env::current_dir] 失败。
///
/// # 示例
///
/// ## POSIX 路径
///
/// ```
/// # #[cfg(unix)]
/// fn main() -> std::io::Result<()> {
///     use std::path::{self, Path};
///
///     // Relative to absolute
///     let absolute = path::absolute("foo/./bar")?;
///     assert!(absolute.ends_with("foo/bar"));
///
///     // Absolute to absolute
///     let absolute = path::absolute("/foo//test/.././bar.rs")?;
///     assert_eq!(absolute, Path::new("/foo/test/../bar.rs"));
///     Ok(())
/// }
/// # #[cfg(not(unix))]
/// # fn main() {}
/// ```
///
/// ## Windows 路径
///
/// ```
/// # #[cfg(windows)]
/// fn main() -> std::io::Result<()> {
///     use std::path::{self, Path};
///
///     // Relative to absolute
///     let absolute = path::absolute("foo/./bar")?;
///     assert!(absolute.ends_with(r"foo\bar"));
///
///     // Absolute to absolute
///     let absolute = path::absolute(r"C:\foo//test\..\./bar.rs")?;
///
///     assert_eq!(absolute, Path::new(r"C:\foo\bar.rs"));
///     Ok(())
/// }
/// # #[cfg(not(windows))]
/// # fn main() {}
/// ```
///
/// 注意这 [未来可能会变化][changes]。
///
/// [changes]: io#platform-specific-behavior
/// [posix-semantics]: https://pubs.opengroup.org/onlinepubs/9799919799/basedefs/V1_chap04.html#tag_04_16
/// [windows-path]: https://docs.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfullpathnamew
/// [cygwin-path]: https://cygwin.com/cygwin-api/func-cygwin-conv-path.html
#[stable(feature = "absolute_path", since = "1.79.0")]
pub fn absolute<P: AsRef<Path>>(path: P) -> io::Result<PathBuf> {
    let path = path.as_ref();
    if path.as_os_str().is_empty() {
        Err(io::const_error!(io::ErrorKind::InvalidInput, "cannot make an empty path absolute"))
    } else {
        sys::path::absolute(path)
    }
}
