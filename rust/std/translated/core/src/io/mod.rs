//! 用于核心 I/O 功能的 trait、辅助函数和类型定义。

mod borrowed_buf;
mod cursor;
mod error;
mod impls;
mod io_slice;
#[unstable(feature = "core_io", issue = "154046")]
pub mod prelude;
mod seek;
mod size_hint;
mod util;
mod write;

#[unstable(feature = "core_io_borrowed_buf", issue = "117693")]
pub use self::borrowed_buf::{BorrowedBuf, BorrowedCursor};
#[unstable(feature = "raw_os_error_ty", issue = "107792")]
pub use self::error::RawOsError;
#[unstable(feature = "io_const_error_internals", issue = "none")]
pub use self::error::SimpleMessage;
#[unstable(feature = "io_const_error", issue = "133448")]
pub use self::error::const_error;
#[unstable(feature = "core_io", issue = "154046")]
pub use self::{
    cursor::Cursor,
    error::{Error, ErrorKind, Result},
    io_slice::{IoSlice, IoSliceMut},
    seek::{Seek, SeekFrom},
    util::{Chain, Empty, Repeat, Sink, Take, empty, repeat, sink},
    write::Write,
};
#[doc(hidden)]
#[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
pub use self::{
    cursor::{
        WriteThroughCursor, slice_write, slice_write_all, slice_write_all_vectored,
        slice_write_vectored,
    },
    error::{Custom, CustomOwner, OsFunctions},
    seek::stream_len_default,
    size_hint::SizeHint,
    util::{chain, take},
    write::default_write_vectored,
};

/// Marks that a type `T` can have IO traits such as [`Seek`], [`Write`], etc. automatically
/// implemented for handle types like [`Arc`][arc] as well.
///
/// This trait should only be implemented for types where `<&T as Trait>::method(&mut &value, ..)`
/// would be identical to `<T as Trait>::method(&mut value, ..)`.
///
/// [`File`][file] passes this test, as operations on `&File` and `File` both affect
/// 同一个底层文件。
/// `[u8]` fails, because any modification to `&mut &[u8]` would only affect a temporary
/// 在调用方法后就会丢失。
///
// FIXME(#74481): Hard-links required to link from `core` to `std`
/// [file]: ../../std/fs/struct.File.html
/// [arc]: ../../alloc/sync/struct.Arc.html
/// [`Write`]: crate::io::Write
/// [`Seek`]: crate::io::Seek
#[doc(hidden)]
#[unstable(feature = "core_io_internals", reason = "exposed only for libstd", issue = "none")]
pub trait IoHandle {}
