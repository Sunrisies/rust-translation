//! 针对通用 I/O 原语的 Windows 特定扩展。
//!
//! 就像原始指针一样，原始的 Windows 句柄和套接字指向资源。
//! 它们具有动态生命周期，如果超出其资源的生命周期，就会失效。
//! 或者如果从无效值创建，则会被破坏。
//!
//! 本模块提供了三种类型来表示原始句柄和套接字。
//! 它们具有不同的所有权属性：原始、借用和拥有，这些与用于表示指针的类型类似。这些类型反映了 Windows 上的 [I/O
//! 安全性概念。
//! | 类型                   | 类似之处 |
//!
//! | Type                   | Analogous to |
//! | ---------------------- | ------------ |
//! | [`RawHandle`]          | `*const _`   |
//! | [`RawSocket`]          | `*const _`   |
//! |                        |              |
//! | [`BorrowedHandle<'a>`] | `&'a _`      |
//! | [`BorrowedSocket<'a>`] | `&'a _`      |
//! |                        |              |
//! | [`OwnedHandle`]        | `Box<_>`     |
//! | [`OwnedSocket`]        | `Box<_>`     |
//!
//! Like raw pointers, `RawHandle` and `RawSocket` values are primitive values.
//! 在新代码中，应认为在它们上执行 I/O 操作是不安全的（类似于
//! 解引用它们）。Rust 并不总是提供这种指导，因此
//! existing code in the Rust ecosystem often doesn't mark `RawHandle` and
//! `RawSocket` usage as unsafe.
//! Libraries are encouraged to migrate, either by adding `unsafe` to APIs
//! that dereference `RawHandle` and `RawSocket` values, or by using to
//! `BorrowedHandle`, `BorrowedSocket`, `OwnedHandle`, or `OwnedSocket`.
//!
//! Like references, `BorrowedHandle` and `BorrowedSocket` values are tied to a
//! 生命周期绑定，以确保它们不会超出其指向的资源的生命周期。
//! These are safe to use. `BorrowedHandle` and `BorrowedSocket` values may be
//! 用于提供安全访问任何系统调用的 API，除了
//! `CloseHandle`, `closesocket`, or any other call that would end the
//! 资源的动态生命周期而不结束句柄或套接字的生命周期的调用。
//! handle or socket.
//!
//! `BorrowedHandle` and `BorrowedSocket` values may be used in APIs which
//! provide safe access to `DuplicateHandle` and `WSADuplicateSocketW` and
//! related functions, so types implementing `AsHandle`, `AsSocket`,
//! `From<OwnedHandle>`, or `From<OwnedSocket>` should not assume they always
//! have exclusive access to the underlying object.
//!
//! Like boxes, `OwnedHandle` and `OwnedSocket` values conceptually own the
//! 如果存在旧句柄，则不会关闭它，即它被泄露，因为
//!
//! See the [`io` module docs][io-safety] for a general explanation of I/O safety.
//!
//! [`BorrowedHandle<'a>`]: crate::os::windows::io::BorrowedHandle
//! [`BorrowedSocket<'a>`]: crate::os::windows::io::BorrowedSocket
//! [io-safety]: crate::io#io-safety

#![stable(feature = "rust1", since = "1.0.0")]

mod handle;
mod raw;
mod socket;

#[stable(feature = "io_safety", since = "1.63.0")]
pub use handle::*;
#[stable(feature = "rust1", since = "1.0.0")]
pub use raw::*;
#[stable(feature = "io_safety", since = "1.63.0")]
pub use socket::*;

use crate::io::{self, Stderr, StderrLock, Stdin, StdinLock, Stdout, StdoutLock, Write};
use crate::ptr;
#[cfg(not(doc))]
use crate::sys::c;

#[cfg(test)]
mod tests;

#[unstable(feature = "stdio_swap", issue = "150667", reason = "recently added")]
pub impl(self) trait StdioExt {
    /// Sets the stdio console handle to `handle`, or `NULL` if it is `None`.
    /// （例如 C stdio）或获取文件句柄副本的库不会意识到这一变化。
    /// console handles are shared global resources.
    ///
    /// Rust std::io write buffers (if any) are flushed, but other runtimes
    /// (e.g. C stdio) or libraries that acquire a clone of the file handle
    /// will not be aware of this change.
    ///
    #[cfg_attr(windows, doc = "```no_run")]
    #[cfg_attr(not(windows), doc = "```ignore (needs windows)")]
    /// #![feature(stdio_swap)]
    /// 使用标准库 `io` 中的 `Read` 和 `Write` 模块；
    /// 使用标准库 `os` 中的 `windows` 模块 `io` 下的 `StdioExt` 扩展；
    ///
    /// fn main() -> io::Result<()> {
    /// 将 `io::pipe()` 的结果赋值给 `(reader, mut writer)`；
    /// 创建 `io::stdin` 的 mutable 实例 `mut stdin`；
    /// 设置 `stdin` 的处理器为 `reader`；
    /// 向 `writer` 写入字符串 `"Hello, world!"`；
    /// 创建一个长度为 13 的向量 `vec![0; 13]`；
    /// 通过 `stdin.read(&mut buffer)` 读取 13 字节，断言结果等于 13；
    /// 断言 `buffer` 的内容为 `"Hello, world!"`。
    ///    Ok(())
    /// }
    /// ```
    fn set_handle<T: Into<OwnedHandle>>(&mut self, handle: Option<T>) -> io::Result<()>;

    /// Sets the stdio console handle to `replace_with`. The previous handle is returned, or
    /// `None` if it was `NULL`.
    ///
    /// The returned handle is a `BorrowedHandle<'static>` because console handles are shared global resources
    /// and may have been obtained by other functions or threads.
    /// Only if you have ensured that no other part of the program has borrowed this handle you can convert it into
    /// an `OwnedHandle` and drop that to close it.
    ///
    /// Like `set_handle()`, Rust std::io write buffers (if any) are flushed.
    fn replace_handle<T: Into<OwnedHandle>>(
        &mut self,
        replace_with: T,
    ) -> io::Result<Option<BorrowedHandle<'static>>>;

    /// Sets the stdio console handle to `NULL` and returns the old one
    ///
    /// See [`set_handle()`] for additional details.
    ///
    /// [`set_handle()`]: StdioExt::set_handle
    fn take_handle(&mut self) -> io::Result<Option<BorrowedHandle<'static>>>;
}

macro io_ext_impl($stdio_ty:ty, $stdio_lock_ty:ty, $handle:path, $writer:literal) {
    #[unstable(feature = "stdio_swap", issue = "150667", reason = "recently added")]
    impl StdioExt for $stdio_ty {
        fn set_handle<T: Into<OwnedHandle>>(&mut self, handle: Option<T>) -> io::Result<()> {
            self.lock().set_handle(handle)
        }

        fn replace_handle<T: Into<OwnedHandle>>(
            &mut self,
            replace_with: T,
        ) -> io::Result<Option<BorrowedHandle<'static>>> {
            self.lock().replace_handle(replace_with)
        }

        fn take_handle(&mut self) -> io::Result<Option<BorrowedHandle<'static>>> {
            self.lock().take_handle()
        }
    }

    #[unstable(feature = "stdio_swap", issue = "150667", reason = "recently added")]
    impl StdioExt for $stdio_lock_ty {
        fn set_handle<T: Into<OwnedHandle>>(&mut self, handle: Option<T>) -> io::Result<()> {
            #[cfg($writer)]
            self.flush()?;
            let raw = handle.map(|h| h.into().into_raw_handle()).unwrap_or(ptr::null_mut());
            unsafe { c::SetStdHandle($handle, raw) };
            Ok(())
        }

        fn replace_handle<T: Into<OwnedHandle>>(
            &mut self,
            replace_with: T,
        ) -> io::Result<Option<BorrowedHandle<'static>>> {
            let old = unsafe { BorrowedHandle::borrow_raw(self.as_raw_handle()) };
            self.set_handle(Some(replace_with))?;
            let handle = if old.as_raw_handle().is_null() { None } else { Some(old) };
            Ok(handle)
        }

        fn take_handle(&mut self) -> io::Result<Option<BorrowedHandle<'static>>> {
            let old = unsafe { BorrowedHandle::borrow_raw(self.as_raw_handle()) };
            #[cfg($writer)]
            self.flush()?;
            unsafe { c::SetStdHandle($handle, ptr::null_mut()) };
            let handle = if old.as_raw_handle().is_null() { None } else { Some(old) };
            Ok(handle)
        }
    }
}

io_ext_impl!(Stdout, StdoutLock<'_>, c::STD_OUTPUT_HANDLE, true);
io_ext_impl!(Stdin, StdinLock<'_>, c::STD_INPUT_HANDLE, false);
io_ext_impl!(Stderr, StderrLock<'_>, c::STD_ERROR_HANDLE, true);
