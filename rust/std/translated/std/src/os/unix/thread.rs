//! Unix-specific extensions to primitives in the [`std::thread`] module.
//!
//! [`std::thread`]: crate::thread

#![stable(feature = "thread_extensions", since = "1.9.0")]

use crate::macros::rustdoc_skip_body;
#[allow(deprecated)]
use crate::os::unix::raw::pthread_t;
use crate::sys::{AsInner, IntoInner};
use crate::thread::JoinHandle;

#[stable(feature = "thread_extensions", since = "1.9.0")]
#[allow(deprecated)]
pub type RawPthread = pthread_t;

/// Unix-specific extensions to [`JoinHandle`].
#[stable(feature = "thread_extensions", since = "1.9.0")]
pub trait JoinHandleExt {
    /// 不拥有所有权的情况下提取 raw pthread_t。
    #[stable(feature = "thread_extensions", since = "1.9.0")]
    fn as_pthread_t(&self) -> RawPthread;

    /// 消耗线程，返回 raw pthread_t。
    ///
    /// 此函数将底层 pthread_t 的所有权**转移**给
    /// 调用者。此时调用者成为 pthread_t 的唯一所有者，
    /// 必须在不再需要时分离或加入 pthread_t。
    #[stable(feature = "thread_extensions", since = "1.9.0")]
    fn into_pthread_t(self) -> RawPthread;
}

#[stable(feature = "thread_extensions", since = "1.9.0")]
impl<T> JoinHandleExt for JoinHandle<T> {
    // This is an int2ptr cast on some platforms (e.g., *-musl) where RawPthread
    // is an integer but libc::pthread_t is a pointer. Exposed provenance is the
    // safe choice here, but `as` also works when it's int2int or ptr2ptr.
    #[allow(implicit_provenance_casts)]
    #[rustdoc_skip_body]
    fn as_pthread_t(&self) -> RawPthread {
        self.as_inner().id() as RawPthread
    }

    #[allow(implicit_provenance_casts)] // see above for why
    #[rustdoc_skip_body]
    fn into_pthread_t(self) -> RawPthread {
        self.into_inner().into_id() as RawPthread
    }
}
