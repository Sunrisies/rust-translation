#![unstable(feature = "core_io", issue = "154046")]

// On 64-bit platforms, `io::Error` may use a bit-packed representation to
// reduce size. However, this representation assumes that error codes are
// always 32-bit wide.
//
// This assumption is invalid on 64-bit UEFI, where error codes are 64-bit.
// Therefore, the packed representation is explicitly disabled for UEFI
// targets, and the unpacked representation must be used instead.
#[cfg_attr(
    all(target_pointer_width = "64", not(target_os = "uefi")),
    path = "error/repr_bitpacked.rs"
)]
#[cfg_attr(
    not(all(target_pointer_width = "64", not(target_os = "uefi"))),
    path = "error/repr_unpacked.rs"
)]
mod repr;

#[cfg_attr(
    all(target_has_atomic_load_store = "ptr", not(no_io_statics)),
    path = "error/os_functions_atomic.rs"
)]
#[cfg_attr(
    not(all(target_has_atomic_load_store = "ptr", not(no_io_statics))),
    path = "error/os_functions.rs"
)]
mod os_functions;

use self::os_functions::{decode_error_kind, format_os_error, is_interrupted, set_functions};
use self::repr::Repr;
use crate::ptr::NonNull;
use crate::{error, fmt, mem, result};

/// A specialized [`Result`] type for I/O operations.
///
/// This type is broadly used across [`std::io`] for any operation which may
/// 产生错误的操作。
///
/// This type alias is generally used to avoid writing out [`io::Error`] directly and
/// is otherwise a direct mapping to [`Result`].
///
/// While usual Rust style is to import types directly, aliases of [`Result`]
/// often are not, to make it easier to distinguish between them. [`Result`] is
/// generally assumed to be [`core::result::Result`][`Result`], and so users of this alias
/// will generally use `io::Result` instead of shadowing the [prelude]'s import
/// of [`core::result::Result`][`Result`].
///
// FIXME(#74481): Hard-links required to link from `core` to `std`
/// [`std::io`]: ../../std/io/index.html
/// [`io::Error`]: Error
/// [`Result`]: crate::result::Result
/// [prelude]: crate::prelude
///
/// # 示例
///
/// A convenience function that bubbles an `io::Result` to its caller:
///
/// ```
/// use std::io;
///
/// fn get_string() -> io::Result<String> {
///     let mut buffer = String::new();
///
///     io::stdin().read_line(&mut buffer)?;
///
///     Ok(buffer)
/// }
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[doc(search_unbox)]
pub type Result<T> = result::Result<T, Error>;

/// The error type for I/O operations of the [`Read`][Read], [`Write`][Write], [`Seek`][Seek], and
/// 关联 trait 的 I/O 操作错误类型。
///
/// 错误大多来自底层操作系统，但可以通过精心设计的错误信息和特定值创建自定义
/// `Error` can be created with crafted error messages and a particular value of
/// [`ErrorKind`].
///
// FIXME(#74481): Hard-links required to link from `core` to `std`
/// [Read]: ../../std/io/trait.Read.html
/// [Write]: crate::io::Write
/// [Seek]: crate::io::Seek
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_has_incoherent_inherent_impls]
pub struct Error {
    repr: Repr,
}

#[stable(feature = "rust1", since = "1.0.0")]
impl fmt::Debug for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Debug::fmt(&self.repr, f)
    }
}

/// std 中常用的错误常量。
#[doc(hidden)]
impl Error {
    #[doc(hidden)]
    #[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
    pub const INVALID_UTF8: Self =
        const_error!(ErrorKind::InvalidData, "stream did not contain valid UTF-8");

    #[doc(hidden)]
    #[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
    pub const READ_EXACT_EOF: Self =
        const_error!(ErrorKind::UnexpectedEof, "failed to fill whole buffer");

    #[doc(hidden)]
    #[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
    pub const UNKNOWN_THREAD_COUNT: Self = const_error!(
        ErrorKind::NotFound,
        "the number of hardware threads is not known for the target platform",
    );

    #[doc(hidden)]
    #[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
    pub const UNSUPPORTED_PLATFORM: Self =
        const_error!(ErrorKind::Unsupported, "operation not supported on this platform");

    #[doc(hidden)]
    #[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
    pub const WRITE_ALL_EOF: Self =
        const_error!(ErrorKind::WriteZero, "failed to write whole buffer");

    #[doc(hidden)]
    #[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
    pub const ZERO_TIMEOUT: Self =
        const_error!(ErrorKind::InvalidInput, "cannot set a 0 duration timeout");

    #[doc(hidden)]
    #[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
    pub const NO_ADDRESSES: Self =
        const_error!(ErrorKind::InvalidInput, "could not resolve to any addresses");
}

// Only derive debug in tests, to make sure it
// doesn't accidentally get printed.
#[cfg_attr(test, derive(Debug))]
enum ErrorData<C> {
    Os(RawOsError),
    Simple(ErrorKind),
    SimpleMessage(&'static SimpleMessage),
    Custom(C),
}

// `#[repr(align(4))]` is probably redundant, it should have that value or
// higher already. We include it just because repr_bitpacked.rs's encoding
// requires an alignment >= 4 (note that `#[repr(align)]` will not reduce the
// alignment required by the struct, only increase it).
//
// If we add more variants to ErrorData, this can be increased to 8, but it
// should probably be behind `#[cfg_attr(target_pointer_width = "64", ...)]` or
// whatever cfg we're using to enable the `repr_bitpacked` code, since only the
// that version needs the alignment, and 8 is higher than the alignment we'll
// have on 32 bit platforms.
//
// (For the sake of being explicit: the alignment requirement here only matters
// if `error/repr_bitpacked.rs` is in use — for the unpacked repr it doesn't
// matter at all)
#[doc(hidden)]
#[unstable(feature = "io_const_error_internals", issue = "none")]
#[repr(align(4))]
#[derive(Debug)]
pub struct SimpleMessage {
    pub kind: ErrorKind,
    pub message: &'static str,
}

/// 从已知类型的错误和字符串字面量创建一个新的 I/O 错误。
///
/// Contrary to [`Error::new`][new], this macro does not allocate and can be used in
/// `const` contexts.
///
// FIXME(#74481): Hard-links required to link from `core` to `alloc` for incoherent method
/// [new]: ../../alloc/io/struct.Error.html#method.new
///
/// # 示例
/// ```
/// #![feature(io_const_error)]
/// use std::io::{const_error, Error, ErrorKind};
///
/// const FAIL: Error = const_error!(ErrorKind::Unsupported, "tried something that never works");
///
/// fn not_here() -> Result<(), Error> {
///     Err(FAIL)
/// }
/// ```
#[rustc_macro_transparency = "semiopaque"]
#[unstable(feature = "io_const_error", issue = "133448")]
#[allow_internal_unstable(core_io, hint_must_use, io_const_error_internals)]
pub macro const_error($kind:expr, $message:expr $(,)?) {
    $crate::hint::must_use($crate::io::Error::from_static_message(
        const { &$crate::io::SimpleMessage { kind: $kind, message: $message } },
    ))
}

/// 适用于不向用户暴露的错误，此时在堆上分配（通过 Error::new 正常构造）成本过高。
/// the heap (for normal construction via Error::new) is too costly.
#[stable(feature = "io_error_from_errorkind", since = "1.14.0")]
impl From<ErrorKind> for Error {
    /// Converts an [`ErrorKind`] into an [`Error`].
    ///
    /// # 示例
    ///
    /// # 安全性
    ///
    /// ```
    /// use std::io::{Error, ErrorKind};
    ///
    /// let not_found = ErrorKind::NotFound;
    /// let error = Error::from(not_found);
    /// assert_eq!("entity not found", format!("{error}"));
    /// ```
    #[inline]
    fn from(kind: ErrorKind) -> Error {
        Error { repr: Repr::new_simple(kind) }
    }
}

impl Error {
    /// # Safety
    ///
    /// The provided `CustomOwner` must have been constructed from a `Box` from the `alloc` crate.
    #[doc(hidden)]
    #[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
    #[must_use]
    #[inline]
    pub unsafe fn from_custom_owner(custom: CustomOwner) -> Error {
        Error { repr: Repr::new_custom(custom) }
    }

    #[doc(hidden)]
    #[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
    #[inline]
    pub fn into_custom_owner(self) -> result::Result<CustomOwner, Self> {
        if matches!(self.repr.data(), ErrorData::Custom(..)) {
            let ErrorData::Custom(c) = self.repr.into_data() else {
                // SAFETY: Checked above using `matches!`.
                unsafe { crate::hint::unreachable_unchecked() }
            };
            Ok(c)
        } else {
            Err(self)
        }
    }

    /// 从已知类型的错误以及常量消息创建一个新的 I/O 错误。
    /// 此函数不会分配内存。
    ///
    /// This function does not allocate.
    ///
    /// You should not use this directly, and instead use the `const_error!`
    /// macro: `io::const_error!(ErrorKind::Something, "some_message")`.
    ///
    /// 此函数未来可能改为 `from_static_message<const MSG: &'static str>(kind: ErrorKind)`， 当泛型支持 const 时。
    /// str>(kind: ErrorKind)` in the future, when const generics allow that.
    #[inline]
    #[doc(hidden)]
    #[unstable(feature = "io_const_error_internals", issue = "none")]
    pub const fn from_static_message(msg: &'static SimpleMessage) -> Error {
        Self { repr: Repr::new_simple_message(msg) }
    }

    /// # 返回此错误所代表的操作系统错误（如果有的话）。
    ///
    /// `functions` must point to data that is entirely constant; it must
    /// not be created during runtime.
    #[doc(hidden)]
    #[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
    #[must_use]
    #[inline]
    pub unsafe fn from_raw_os_error_with_functions(
        code: RawOsError,
        functions: &'static OsFunctions,
    ) -> Error {
        // SAFETY: Caller ensures `functions` is a constant not created at runtime.
        unsafe {
            set_functions(functions);
        }
        Error { repr: Repr::new_os(code) }
    }

    /// # 示例
    ///
    /// If this [`Error`] was constructed via [`last_os_error`][last_os_error] or
    /// [`from_raw_os_error`][from_raw_os_error], then this function will return [`Some`], otherwise
    /// it will return [`None`].
    ///
    // FIXME(#74481): Hard-links required to link from `core` to `std` for incoherent method
    /// [last_os_error]: ../../std/io/struct.Error.html#method.last_os_error
    /// [from_raw_os_error]: ../../std/io/struct.Error.html#method.from_raw_os_error
    ///
    /// # Examples
    ///
    /// ```
    /// use std::io::{Error, ErrorKind};
    ///
    /// fn print_os_error(err: &Error) {
    ///     if let Some(raw_os_err) = err.raw_os_error() {
    ///         println!("raw OS error: {raw_os_err:?}");
    ///     } else {
    ///         println!("Not an OS error");
    ///     }
    /// }
    ///
    /// fn main() {
    ///     // Will print "raw OS error: ...".
    ///     print_os_error(&Error::last_os_error());
    ///     // Will print "Not an OS error".
    ///     print_os_error(&Error::new(ErrorKind::Other, "oh no!"));
    /// }
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    #[inline]
    pub fn raw_os_error(&self) -> Option<RawOsError> {
        match self.repr.data() {
            ErrorData::Os(i) => Some(i),
            ErrorData::Custom(..) => None,
            ErrorData::Simple(..) => None,
            ErrorData::SimpleMessage(..) => None,
        }
    }

    /// Returns a reference to the inner error wrapped by this error (if any).
    ///
    /// If this [`Error`] was constructed via [`new`][new] then this function will
    /// return [`Some`], otherwise it will return [`None`].
    ///
    /// [new]: ../../alloc/io/struct.Error.html#method.new
    ///
    /// # 示例
    ///
    /// ```
    /// use std::io::{Error, ErrorKind};
    ///
    /// fn print_error(err: &Error) {
    ///     if let Some(inner_err) = err.get_ref() {
    ///         println!("Inner error: {inner_err:?}");
    ///     } else {
    ///         println!("No inner error");
    ///     }
    /// }
    ///
    /// fn main() {
    ///     // Will print "No inner error".
    ///     print_error(&Error::last_os_error());
    ///     // Will print "Inner error: ...".
    ///     print_error(&Error::new(ErrorKind::Other, "oh no!"));
    /// }
    /// ```
    #[stable(feature = "io_error_inner", since = "1.3.0")]
    #[must_use]
    #[inline]
    pub fn get_ref(&self) -> Option<&(dyn error::Error + Send + Sync + 'static)> {
        match self.repr.data() {
            ErrorData::Os(..) => None,
            ErrorData::Simple(..) => None,
            ErrorData::SimpleMessage(..) => None,
            ErrorData::Custom(c) => Some(c.error_ref()),
        }
    }

    /// 返回对内部错误的可修改引用，该内部错误由此错误包裹
    /// （如果有的话）。
    ///
    /// If this [`Error`] was constructed via [`new`][new] then this function will
    /// return [`Some`], otherwise it will return [`None`].
    ///
    // FIXME(#74481): Hard-links required to link from `core` to `std`
    /// [new]: ../../alloc/io/struct.Error.html#method.new
    ///
    /// # 示例
    ///
    /// ```
    /// use std::io::{Error, ErrorKind};
    /// use std::{error, fmt};
    /// use std::fmt::Display;
    ///
    /// #[derive(Debug)]
    /// struct MyError {
    ///     v: String,
    /// }
    ///
    /// impl MyError {
    ///     fn new() -> MyError {
    ///         MyError {
    ///             v: "oh no!".to_string()
    ///         }
    ///     }
    ///
    ///     fn change_message(&mut self, new_message: &str) {
    ///         self.v = new_message.to_string();
    ///     }
    /// }
    ///
    /// impl error::Error for MyError {}
    ///
    /// impl Display for MyError {
    ///     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    ///         write!(f, "MyError: {}", self.v)
    ///     }
    /// }
    ///
    /// fn change_error(mut err: Error) -> Error {
    ///     if let Some(inner_err) = err.get_mut() {
    ///         inner_err.downcast_mut::<MyError>().unwrap().change_message("I've been changed!");
    ///     }
    ///     err
    /// }
    ///
    /// fn print_error(err: &Error) {
    ///     if let Some(inner_err) = err.get_ref() {
    ///         println!("Inner error: {inner_err}");
    ///     } else {
    ///         println!("No inner error");
    ///     }
    /// }
    ///
    /// fn main() {
    ///     // Will print "No inner error".
    ///     print_error(&change_error(Error::last_os_error()));
    ///     // Will print "Inner error: ...".
    ///     print_error(&change_error(Error::new(ErrorKind::Other, MyError::new())));
    /// }
    /// ```
    #[stable(feature = "io_error_inner", since = "1.3.0")]
    #[must_use]
    #[inline]
    pub fn get_mut(&mut self) -> Option<&mut (dyn error::Error + Send + Sync + 'static)> {
        match self.repr.data_mut() {
            ErrorData::Os(..) => None,
            ErrorData::Simple(..) => None,
            ErrorData::SimpleMessage(..) => None,
            ErrorData::Custom(c) => Some(c.error_mut()),
        }
    }

    /// Returns the corresponding [`ErrorKind`] for this error.
    ///
    /// This may be a value set by Rust code constructing custom `io::Error`s,
    /// or if this `io::Error` was sourced from the operating system,
    /// 它将是系统错误编码中推断出的值。
    /// See [`last_os_error`][last_os_error] for more details.
    ///
    // FIXME(#74481): Hard-links required to link from `core` to `std`
    /// [last_os_error]: ../../std/io/struct.Error.html#method.last_os_error
    ///
    /// # 示例
    ///
    /// ```
    /// use std::io::{Error, ErrorKind};
    ///
    /// fn print_error(err: Error) {
    ///     println!("{:?}", err.kind());
    /// }
    ///
    /// fn main() {
    ///     // As no error has (visibly) occurred, this may print anything!
    ///     // It likely prints a placeholder for unidentified (non-)errors.
    ///     print_error(Error::last_os_error());
    ///     // Will print "AddrInUse".
    ///     print_error(Error::new(ErrorKind::AddrInUse, "oh no!"));
    /// }
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    #[inline]
    pub fn kind(&self) -> ErrorKind {
        match self.repr.data() {
            ErrorData::Os(code) => decode_error_kind(code),
            ErrorData::Custom(c) => c.kind,
            ErrorData::Simple(kind) => kind,
            ErrorData::SimpleMessage(m) => m.kind,
        }
    }

    #[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
    #[doc(hidden)]
    #[inline]
    pub fn is_interrupted(&self) -> bool {
        match self.repr.data() {
            ErrorData::Os(code) => is_interrupted(code),
            ErrorData::Custom(c) => c.kind == ErrorKind::Interrupted,
            ErrorData::Simple(kind) => kind == ErrorKind::Interrupted,
            ErrorData::SimpleMessage(m) => m.kind == ErrorKind::Interrupted,
        }
    }
}

impl fmt::Debug for Repr {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.data() {
            ErrorData::Os(code) => fmt
                .debug_struct("Os")
                .field("code", &code)
                .field("kind", &decode_error_kind(code))
                .field(
                    "message",
                    &fmt::from_fn(|fmt| {
                        write!(fmt, "\"{}\"", fmt::from_fn(|fmt| format_os_error(code, fmt)))
                    }),
                )
                .finish(),
            ErrorData::Custom(c) => fmt::Debug::fmt(&c, fmt),
            ErrorData::Simple(kind) => fmt.debug_tuple("Kind").field(&kind).finish(),
            ErrorData::SimpleMessage(msg) => fmt
                .debug_struct("Error")
                .field("kind", &msg.kind)
                .field("message", &msg.message)
                .finish(),
        }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl fmt::Display for Error {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.repr.data() {
            ErrorData::Os(code) => {
                let detail = fmt::from_fn(|fmt| format_os_error(code, fmt));
                write!(fmt, "{detail} (os error {code})")
            }
            ErrorData::Custom(c) => fmt::Display::fmt(c.error_ref(), fmt),
            ErrorData::Simple(kind) => kind.fmt(fmt),
            ErrorData::SimpleMessage(msg) => msg.message.fmt(fmt),
        }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl error::Error for Error {
    #[allow(deprecated)]
    fn cause(&self) -> Option<&dyn error::Error> {
        match self.repr.data() {
            ErrorData::Os(..) => None,
            ErrorData::Simple(..) => None,
            ErrorData::SimpleMessage(..) => None,
            ErrorData::Custom(c) => c.error_ref().cause(),
        }
    }

    fn source(&self) -> Option<&(dyn error::Error + 'static)> {
        match self.repr.data() {
            ErrorData::Os(..) => None,
            ErrorData::Simple(..) => None,
            ErrorData::SimpleMessage(..) => None,
            ErrorData::Custom(c) => c.error_ref().source(),
        }
    }
}

fn _assert_error_is_sync_send() {
    fn _is_sync_send<T: Sync + Send>() {}
    _is_sync_send::<Error>();
}

#[doc(hidden)]
#[derive(Debug)]
#[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
pub struct OsFunctions {
    pub format_os_error: fn(_: RawOsError, _: &mut fmt::Formatter<'_>) -> fmt::Result,
    pub decode_error_kind: fn(_: RawOsError) -> ErrorKind,
    pub is_interrupted: fn(_: RawOsError) -> bool,
}

impl OsFunctions {
    const DEFAULT: &'static OsFunctions = &OsFunctions {
        format_os_error: |_, _| Ok(()),
        decode_error_kind: |_| ErrorKind::Uncategorized,
        is_interrupted: |_| false,
    };
}

/// 用户创建并分配的错误。
// As with `SimpleMessage`: `#[repr(align(4))]` here is just because
// repr_bitpacked's encoding requires it. In practice it almost certainly be
// already be this high or higher.
#[doc(hidden)]
#[repr(align(4))]
#[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
pub struct Custom {
    kind: ErrorKind,
    /// `Box<dyn Error + ...>` without `alloc`.
    // INVARIANT: `error` must be a valid pointer and it must be safe to call `error_drop`
    // with it once.
    error: NonNull<dyn error::Error + Send + Sync>,
    error_drop: unsafe fn(NonNull<dyn error::Error + Send + Sync>),
    /// Call to drop a pointer to `Custom`.
    // INVARIANT: must be safe to call once with a pointer to `Self` in `CustomOwner`.
    outer_drop: unsafe fn(NonNull<Self>),
}

// SAFETY: All members of `Custom` are `Send`
#[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
unsafe impl Send for Custom {}

// SAFETY: All members of `Custom` are `Sync`
#[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
unsafe impl Sync for Custom {}

#[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
impl fmt::Debug for Custom {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Custom").field("kind", &self.kind).field("error", self.error_ref()).finish()
    }
}

#[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
impl Drop for Custom {
    fn drop(&mut self) {
        // SAFETY: by `Custom` invariants, this is a drop call on a valid pointer.
        unsafe {
            (self.error_drop)(self.error);
        }
    }
}

impl Custom {
    /// # 安全性
    ///
    /// * `error` must be valid for up to a static lifetime, and own its pointee.
    /// * `error_drop` must be safe to call for the pointer `error` exactly once.
    /// * `outer_drop` must be safe to call on a pointer to this instance of `Custom`
    ///   (the pointer is likely stored within a [`CustomOwner`]).
    #[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
    pub unsafe fn from_raw(
        kind: ErrorKind,
        error: NonNull<dyn error::Error + Send + Sync>,
        error_drop: unsafe fn(NonNull<dyn error::Error + Send + Sync>),
        outer_drop: unsafe fn(NonNull<Self>),
    ) -> Custom {
        // INVARIANT: function preconditions match type invariants.
        Custom { kind, error, error_drop, outer_drop }
    }

    #[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
    pub fn into_raw(self) -> NonNull<dyn error::Error + Send + Sync> {
        let ptr = self.error;
        // Avoid `Custom::drop` which would free the error pointer.
        mem::forget(self);
        ptr
    }

    fn error_ref(&self) -> &(dyn error::Error + Send + Sync + 'static) {
        // SAFETY:
        // `from_raw` ensures `error` is a valid pointer up to a static lifetime
        // and is owned by `self`
        unsafe { self.error.as_ref() }
    }

    fn error_mut(&mut self) -> &mut (dyn error::Error + Send + Sync + 'static) {
        // SAFETY:
        // `from_raw` ensures `error` is a valid pointer up to a static lifetime
        // and is owned by `self`
        unsafe { self.error.as_mut() }
    }
}

/// Effectively a `Box<Custom>` without `alloc`. The `Custom` holds the call to free this pointer.
// INVARIANT: `self.0.outer_drop` must be safe to call once with `self.0`.
#[derive(Debug)]
#[repr(transparent)]
#[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
#[doc(hidden)]
pub struct CustomOwner(NonNull<Custom>);

// SAFETY: Custom is `Send`
#[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
unsafe impl Send for CustomOwner {}

// SAFETY: Custom is `Sync`
#[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
unsafe impl Sync for CustomOwner {}

#[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
impl Drop for CustomOwner {
    fn drop(&mut self) {
        // SAFETY: by `CustomOwner` invariants, this is a drop call on a valid pointer.
        unsafe {
            (self.0.as_ref().outer_drop)(self.0);
        }
    }
}

impl CustomOwner {
    /// # 安全性
    ///
    /// * `custom` must point to valid `Custom`.
    /// * The `outer_drop` of the provided `custom` must be the drop function for this pointer.
    #[doc(hidden)]
    #[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
    pub unsafe fn from_raw(custom: NonNull<Custom>) -> CustomOwner {
        // INVARIANT: by the preconditions, `custom.outer_drop` is the drop for `custom`.
        CustomOwner(custom)
    }

    #[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
    pub fn into_raw(self) -> NonNull<Custom> {
        let ptr = self.0;
        // Avoid `CustomOwner::drop`, which would free the pointer.
        mem::forget(self);
        ptr
    }

    #[allow(dead_code, reason = "only used for unpacked representation")]
    fn custom_ref(&self) -> &Custom {
        // SAFETY:
        // `from_raw` ensures `0` is a valid pointer up to a static lifetime
        // and is owned by `self`
        unsafe { self.0.as_ref() }
    }

    #[allow(dead_code, reason = "only used for unpacked representation")]
    fn custom_mut(&mut self) -> &mut Custom {
        // SAFETY:
        // `from_raw` ensures `0` is a valid pointer up to a static lifetime
        // and is owned by `self`
        unsafe { self.0.as_mut() }
    }
}

/// 原始操作系统错误代码的类型。
///
/// This is an [`i32`] on all currently supported platforms, but platforms
/// （如 UEFI）可能使用不同的基本类型，例如
/// [`usize`] or [`i16`]. Use `as` or [`into`] conversions where applicable to
/// ensure maximum portability.
///
/// [`into`]: Into::into
#[unstable(feature = "raw_os_error_ty", issue = "107792")]
pub type RawOsError = cfg_select! {
    target_os = "uefi" => usize,
    // For 16-bit AVR and MSP430, i16 is equivalent to c_int.
    // Using i16 to be explicit.
    target_pointer_width = "16" => i16,
    _ => i32,
};

/// 指定 I/O 错误一般类别的列表。
///
/// 此列表预计会随时间增长，不建议
/// 完全与之匹配。
///
/// It is used with the [`io::Error`][error] type.
///
/// [error]: Error
///
/// # Handling errors and matching on `ErrorKind`
///
/// In application code, use `match` for the `ErrorKind` values you are
/// expecting; use `_` to match "all other errors".
///
/// In comprehensive and thorough tests that want to verify that a test doesn't
/// return any known incorrect error kind, you may want to cut-and-paste the
/// current full list of errors from here into your test code, and then match
/// `_` as the correct case. This seems counterintuitive, but it will make your
/// tests more robust. In particular, if you want to verify that your code does
/// 产生无法识别的错误类型，稳健的解决方案是检查所有错误类型。
/// 检查已识别的错误类型，并在这些情况下失败。
#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "io_errorkind")]
#[allow(deprecated)]
#[non_exhaustive]
pub enum ErrorKind {
    /// 未找到实体，通常是一个文件。
    #[stable(feature = "rust1", since = "1.0.0")]
    NotFound,
    /// 操作缺乏完成所需的权限。
    #[stable(feature = "rust1", since = "1.0.0")]
    PermissionDenied,
    /// 远程服务器拒绝连接。
    #[stable(feature = "rust1", since = "1.0.0")]
    ConnectionRefused,
    /// 远程服务器重置了连接。
    #[stable(feature = "rust1", since = "1.0.0")]
    ConnectionReset,
    /// 无法访问远程主机。
    #[stable(feature = "io_error_a_bit_more", since = "1.83.0")]
    HostUnreachable,
    /// 包含远程主机的网络不可达。
    #[stable(feature = "io_error_a_bit_more", since = "1.83.0")]
    NetworkUnreachable,
    /// 连接被远程服务器终止。
    #[stable(feature = "rust1", since = "1.0.0")]
    ConnectionAborted,
    /// 网络操作失败，因为尚未建立连接。
    #[stable(feature = "rust1", since = "1.0.0")]
    NotConnected,
    /// 套接字地址无法绑定，因为该地址已存在于其他位置。
    /// 请求了一个不存在的接口或请求的地址不是本地地址。
    #[stable(feature = "rust1", since = "1.0.0")]
    AddrInUse,
    /// 期望的接口不存在，或者请求的地址不是本地地址。
    /// 本地地址。
    #[stable(feature = "rust1", since = "1.0.0")]
    AddrNotAvailable,
    /// 系统的网络功能关闭。
    #[stable(feature = "io_error_a_bit_more", since = "1.83.0")]
    NetworkDown,
    /// 操作失败，因为管道被关闭。
    #[stable(feature = "rust1", since = "1.0.0")]
    BrokenPipe,
    /// 实体已存在，通常是一个文件。
    #[stable(feature = "rust1", since = "1.0.0")]
    AlreadyExists,
    /// 操作需要阻塞以完成，但阻塞操作被禁止。
    /// 请求不执行阻塞操作。
    #[stable(feature = "rust1", since = "1.0.0")]
    WouldBlock,
    /// 文件系统对象意外地不是目录。
    ///
    /// 例如，指定了文件系统路径，其中中间目录组件实际上是一个普通文件。
    /// 文件系统对象意外地是目录。
    #[stable(feature = "io_error_a_bit_more", since = "1.83.0")]
    NotADirectory,
    /// 文件系统对象意外地是目录。
    ///
    /// 期望非目录时却指定了目录。
    #[stable(feature = "io_error_a_bit_more", since = "1.83.0")]
    IsADirectory,
    /// 期望空目录时却指定了非空目录。
    #[stable(feature = "io_error_a_bit_more", since = "1.83.0")]
    DirectoryNotEmpty,
    /// 文件系统或存储介质为只读，但尝试了写入操作。
    #[stable(feature = "io_error_a_bit_more", since = "1.83.0")]
    ReadOnlyFilesystem,
    /// 文件系统或 IO 子系统中的循环；通常是过多的符号链接层级。
    ///
    /// 在解析文件系统对象或文件 IO 对象时存在循环（或过长的链）。
    /// 在 Unix 系统上，这通常是由于符号链接循环导致的；或者超过了系统特定的符号链接遍历深度限制。
    ///
    /// 过期的网络文件句柄。
    /// 在某些网络文件系统，尤其是 NFS 中，打开的文件（或目录）可能因网络或服务器问题而失效。
    #[unstable(feature = "io_error_more", issue = "86442")]
    FilesystemLoop,
    /// 过期的网络文件句柄。
    ///
    /// 某些网络文件系统，特别是 NFS，打开的文件（或目录）可能因网络或服务器问题而失效。
    /// 参数不正确。
    #[stable(feature = "io_error_a_bit_more", since = "1.83.0")]
    StaleNetworkFileHandle,
    /// 遇到不适用于该操作的数据。
    #[stable(feature = "rust1", since = "1.0.0")]
    InvalidInput,
    /// Data not valid for the operation were encountered.
    ///
    /// Unlike [`InvalidInput`], this typically means that the operation
    /// I/O 操作的超时时间到期，导致操作被取消。
    /// input data.
    ///
    /// For example, a function that reads a file into a string will error with
    /// `InvalidData` if the file's contents are not valid UTF-8.
    ///
    /// [`InvalidInput`]: ErrorKind::InvalidInput
    #[stable(feature = "io_invalid_data", since = "1.2.0")]
    InvalidData,
    /// The I/O operation's timeout expired, causing it to be canceled.
    #[stable(feature = "rust1", since = "1.0.0")]
    TimedOut,
    /// 当操作无法完成时，返回了错误，因为
    /// call to [`write`][write] returned [`Ok(0)`].
    ///
    /// 这通常意味着操作只有在写入特定数量的字节时才能成功，但只能写入较少数量的字节。
    /// 。
    /// 。
    ///
    /// [write]: crate::io::Write::write
    /// [`Ok(0)`]: Ok
    #[stable(feature = "rust1", since = "1.0.0")]
    WriteZero,
    /// 底层存储（通常是文件系统）已满。
    ///
    /// 这不包括超出配额的错误。
    #[stable(feature = "io_error_a_bit_more", since = "1.83.0")]
    StorageFull,
    /// 在不可寻址文件上寻找。
    ///
    /// Seeking was attempted on an open file handle which is not suitable for seeking - for
    /// example, on Unix, a named pipe opened with `File::open`.
    #[stable(feature = "io_error_a_bit_more", since = "1.83.0")]
    NotSeekable,
    /// 文件大于允许或支持的大小。
    #[stable(feature = "io_error_quota_exceeded", since = "1.85.0")]
    QuotaExceeded,
    /// 文件大于允许或支持的大小。
    ///
    /// 这可能是由于底层文件系统或文件访问 API 的硬性限制，或者是
    /// 管理上施加的资源限制。简单的磁盘已满和超出配额也有各自的错误。
    /// 资源正在被使用。
    #[stable(feature = "io_error_a_bit_more", since = "1.83.0")]
    FileTooLarge,
    /// 资源正在被使用。
    #[stable(feature = "io_error_a_bit_more", since = "1.83.0")]
    ResourceBusy,
    /// 可执行文件正在被使用。
    ///
    /// 尝试向同时作为运行程序使用的文件写入数据。（并非所有）
    /// 操作系统都能检测到这种情况。
    #[stable(feature = "io_error_a_bit_more", since = "1.83.0")]
    ExecutableFileBusy,
    /// 死锁（已避免）。
    ///
    /// 文件锁定操作会导致死锁。这种情况通常会在
    /// 至少以尽力而为的方式被检测到。
    #[stable(feature = "io_error_a_bit_more", since = "1.83.0")]
    Deadlock,
    /// 跨设备或跨文件系统（硬性）链接或重命名。
    #[stable(feature = "io_error_crosses_devices", since = "1.85.0")]
    CrossesDevices,
    /// 对同一文件系统对象有过多的（硬性）链接。
    ///
    /// 文件系统不支持对同一文件创建如此多的硬性链接。
    #[stable(feature = "io_error_a_bit_more", since = "1.83.0")]
    TooManyLinks,
    /// 文件名无效。
    ///
    /// 如果名称的长度限制被超出，也会出现此错误。
    #[stable(feature = "io_error_invalid_filename", since = "1.87.0")]
    InvalidFilename,
    /// 程序参数列表过长。
    ///
    /// 在尝试运行外部程序时，系统或进程对参数大小的限制被超出。
    /// 。
    #[stable(feature = "io_error_a_bit_more", since = "1.83.0")]
    ArgumentListTooLong,
    /// 此操作被中断。
    ///
    /// 被中断的操作通常可以重试。
    #[stable(feature = "rust1", since = "1.0.0")]
    Interrupted,

    /// 此操作在此平台上不受支持。
    ///
    /// 这意味着该操作永远无法成功。
    #[stable(feature = "unsupported_error", since = "1.53.0")]
    Unsupported,

    // ErrorKinds which are primarily categorisations for OS error
    // codes should be added above.
    //
    /// 当操作无法完成时，返回了错误，因为
    /// “文件结束”被过早到达。
    ///
    /// 这通常意味着操作只有在读取特定数量的字节时才能成功，但只能读取较少数量的字节。
    /// 。
    /// 操作无法完成，因为它未能分配足够的内存。
    #[stable(feature = "read_exact", since = "1.6.0")]
    UnexpectedEof,

    /// 操作无法完成，因为它失败了
    /// 分配足够的内存。
    #[stable(feature = "out_of_memory_error", since = "1.54.0")]
    OutOfMemory,

    /// 操作部分成功，由于不阻塞，需要稍后检查。
    /// 。
    #[unstable(feature = "io_error_inprogress", issue = "130840")]
    InProgress,

    /// 进程或整个系统达到了其数量限制
    /// 打开文件或套接字。
    #[unstable(feature = "io_error_too_many_open_files", issue = "158319")]
    TooManyOpenFiles,

    /// 低级别输入/输出错误。
    ///
    /// 这通常表示硬件或设备层面的故障，例如坏磁盘扇区或被移除的设备，但操作系统也可能报告
    /// 其他低级别I/O情况。
    /// 此类问题。
    #[unstable(feature = "io_error_input_output_error", issue = "159066")]
    InputOutputError,

    // "Unusual" error kinds which do not correspond simply to (sets
    // of) OS error codes, should be added just above this comment.
    // `Other` and `Uncategorized` should remain at the end:
    //
    /// 一种不属于其他任何I/O错误类型的自定义错误。
    ///
    /// This can be used to construct your own [`Error`][error]s that do not match any
    /// [`ErrorKind`].
    ///
    /// This [`ErrorKind`] is not used by the standard library.
    ///
    /// 标准库中不属于任何I/O错误类型的错误。
    /// error kinds cannot be `match`ed on, and will only match a wildcard (`_`) pattern.
    /// New [`ErrorKind`]s might be added in the future for some of those.
    ///
    /// [error]: Error
    #[stable(feature = "rust1", since = "1.0.0")]
    Other,

    /// 标准库中不属于此列表的任何I/O错误。
    ///
    /// Errors that are `Uncategorized` now may move to a different or a new
    /// [`ErrorKind`] variant in the future. It is not recommended to match
    /// an error against `Uncategorized`; use a wildcard match (`_`) instead.
    #[unstable(feature = "io_error_uncategorized", issue = "none")]
    #[doc(hidden)]
    Uncategorized,
}

impl ErrorKind {
    const fn as_str(&self) -> &'static str {
        use ErrorKind::*;
        match *self {
            // tidy-alphabetical-start
            AddrInUse => "address in use",
            AddrNotAvailable => "address not available",
            AlreadyExists => "entity already exists",
            ArgumentListTooLong => "argument list too long",
            BrokenPipe => "broken pipe",
            ConnectionAborted => "connection aborted",
            ConnectionRefused => "connection refused",
            ConnectionReset => "connection reset",
            CrossesDevices => "cross-device link or rename",
            Deadlock => "deadlock",
            DirectoryNotEmpty => "directory not empty",
            ExecutableFileBusy => "executable file busy",
            FileTooLarge => "file too large",
            FilesystemLoop => "filesystem loop or indirection limit (e.g. symlink loop)",
            HostUnreachable => "host unreachable",
            InProgress => "in progress",
            InputOutputError => "input/output error",
            Interrupted => "operation interrupted",
            InvalidData => "invalid data",
            InvalidFilename => "invalid filename",
            InvalidInput => "invalid input parameter",
            IsADirectory => "is a directory",
            NetworkDown => "network down",
            NetworkUnreachable => "network unreachable",
            NotADirectory => "not a directory",
            NotConnected => "not connected",
            NotFound => "entity not found",
            NotSeekable => "seek on unseekable file",
            Other => "other error",
            OutOfMemory => "out of memory",
            PermissionDenied => "permission denied",
            QuotaExceeded => "quota exceeded",
            ReadOnlyFilesystem => "read-only filesystem or storage medium",
            ResourceBusy => "resource busy",
            StaleNetworkFileHandle => "stale network file handle",
            StorageFull => "no storage space",
            TimedOut => "timed out",
            TooManyLinks => "too many links",
            TooManyOpenFiles => "too many open files",
            Uncategorized => "uncategorized error",
            UnexpectedEof => "unexpected end of file",
            Unsupported => "unsupported",
            WouldBlock => "operation would block",
            WriteZero => "write zero",
            // tidy-alphabetical-end
        }
    }

    // This compiles to the same code as the check+transmute, but doesn't require
    // unsafe, or to hard-code max ErrorKind or its size in a way the compiler
    // couldn't verify.
    #[inline]
    #[allow(dead_code, reason = "only used for packed representation")]
    const fn from_prim(ek: u32) -> Option<Self> {
        macro_rules! from_prim {
            ($prim:expr => $Enum:ident { $($Variant:ident),* $(,)? }) => {{
                // Force a compile error if the list gets out of date.
                const _: fn(e: $Enum) = |e: $Enum| match e {
                    $($Enum::$Variant => (),)*
                };
                match $prim {
                    $(v if v == ($Enum::$Variant as _) => Some($Enum::$Variant),)*
                    _ => None,
                }
            }}
        }
        from_prim!(ek => ErrorKind {
            NotFound,
            PermissionDenied,
            ConnectionRefused,
            ConnectionReset,
            HostUnreachable,
            NetworkUnreachable,
            ConnectionAborted,
            NotConnected,
            AddrInUse,
            AddrNotAvailable,
            NetworkDown,
            BrokenPipe,
            AlreadyExists,
            WouldBlock,
            NotADirectory,
            IsADirectory,
            DirectoryNotEmpty,
            ReadOnlyFilesystem,
            FilesystemLoop,
            StaleNetworkFileHandle,
            InvalidInput,
            InvalidData,
            TimedOut,
            WriteZero,
            StorageFull,
            NotSeekable,
            QuotaExceeded,
            FileTooLarge,
            ResourceBusy,
            ExecutableFileBusy,
            Deadlock,
            CrossesDevices,
            TooManyLinks,
            InvalidFilename,
            ArgumentListTooLong,
            Interrupted,
            Other,
            UnexpectedEof,
            Unsupported,
            OutOfMemory,
            InProgress,
            TooManyOpenFiles,
            InputOutputError,
            Uncategorized,
        })
    }
}

#[stable(feature = "io_errorkind_display", since = "1.60.0")]
impl fmt::Display for ErrorKind {
    /// Shows a human-readable description of the [`ErrorKind`].
    ///
    /// This is similar to `impl Display for Error`, but doesn't require first converting to Error.
    ///
    /// # 示例
    ///
    /// ```
    /// use core::io::ErrorKind;
    /// assert_eq!("entity not found", ErrorKind::NotFound.to_string());
    /// ```
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt.write_str(self.as_str())
    }
}
