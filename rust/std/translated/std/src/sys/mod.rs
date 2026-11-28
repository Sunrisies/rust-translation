#![allow(unsafe_op_in_unsafe_fn)]

mod configure_builtins;
mod helpers;
mod pal;
mod personality;

pub mod alloc;
pub mod args;
pub mod backtrace;
pub mod cmath;
pub mod env;
pub mod env_consts;
pub mod exit;
pub mod fd;
pub mod fs;
pub mod io;
pub mod net;
pub mod os_str;
pub mod path;
pub mod paths;
pub mod pipe;
pub mod platform_version;
pub mod process;
pub mod random;
pub mod stdio;
pub mod sync;
pub mod thread;
pub mod thread_local;
pub mod time;

// FIXME(117276): remove this, move feature implementations into individual
//                submodules.
pub use pal::*;

/// 一个用于从标准类型查看表示的 trait。
#[cfg_attr(not(target_os = "linux"), allow(unused))]
pub(crate) trait AsInner<Inner: ?Sized> {
    fn as_inner(&self) -> &Inner;
}

/// 一个用于从标准类型查看表示的 trait。
#[cfg_attr(not(target_os = "linux"), allow(unused))]
pub(crate) trait AsInnerMut<Inner: ?Sized> {
    fn as_inner_mut(&mut self) -> &mut Inner;
}

/// 一个用于从标准类型提取表示的 trait。
pub(crate) trait IntoInner<Inner> {
    fn into_inner(self) -> Inner;
}

/// 一个用于从内部表示创建标准类型的 trait。
pub(crate) trait FromInner<Inner> {
    fn from_inner(inner: Inner) -> Self;
}
