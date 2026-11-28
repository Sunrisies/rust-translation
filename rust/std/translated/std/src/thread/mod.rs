//! 原生线程。
//!
//! ## 线程模型
//!
//! 一个正在运行的 Rust 程序由一系列原生操作系统线程组成，
//! 每个线程都有自己的栈和局部状态。线程可以被命名，并且
//! 提供了一些内置的低级同步支持。
//!
//! 线程之间的通信可以通过
//! [通道]、Rust 的消息传递类型以及[其他形式的线程
//! synchronization](../../std/sync/index.html) and shared-memory data
//! structures. In particular, types that are guaranteed to be
//! 线程安全的类型，可以通过
//! atomically-reference-counted container, [`Arc`].
//!
//! Rust 中的致命逻辑错误会导致*panic*，在此期间
//! 一个线程会展开其栈，执行析构函数并释放
//! 所有权资源。虽然这不是一种“try/catch”机制，但在 Rust 中
//! in Rust can nonetheless be caught (unless compiling with `panic=abort`) with
//! [`catch_unwind`](../../std/panic/fn.catch_unwind.html) and recovered
//! 从某个点重新开始，或者可以用
//! [`resume_unwind`](../../std/panic/fn.resume_unwind.html). If the panic
//! 未被捕获，线程将退出，但 panic 也可以由另一个线程
//! detected from a different thread with [`join`]. If the main thread panics
//! 且 panic 未被捕获，应用程序将以非零退出码退出。
//! 退出。
//!
//! 当 Rust 程序的主线程终止时，整个程序将关闭，
//! 即使其他线程仍在运行，也会关闭。剩余线程栈上的任何析构函数可能不会被执行。不过，这个模块
//! 提供了方便的功能，可以自动等待线程的
//! 终止（即 join）。
//! ## 创建线程
//!
//! ## 创建线程
//!
//! A new thread can be spawned using the [`thread::spawn`][`spawn`] function:
//!
//! ```rust
//! use std::thread;
//!
//! thread::spawn(move || {
//!     // some work here
//! });
//! ```
//!
//! 在这个示例中，新创建的线程是“分离”的，这意味着程序无法知道
//! 新线程何时完成或终止。
//! terminates.
//!
//! To learn when a thread completes, it is necessary to capture the [`JoinHandle`]
//! object that is returned by the call to [`spawn`], which provides
//! a `join` method that allows the caller to wait for the completion of the
//! spawned thread:
//!
//! ```rust
//! use std::thread;
//!
//! let thread_join_handle = thread::spawn(move || {
//!     // some work here
//! });
//! // some work here
//! let res = thread_join_handle.join();
//! ```
//!
//! The [`join`] method returns a [`thread::Result`] containing [`Ok`] of the final
//! value produced by the spawned thread, or [`Err`] of the value given to
//! a call to [`panic!`] if the thread panicked.
//!
//! Note that there is no parent/child relationship between a thread that spawns a
//! 新线程与被生成的线程。特别是，生成的线程可能或
//! 不会超过生成线程的生命周期，除非生成线程是主线程。
//!
//! ## 配置线程
//!
//! A new thread can be configured before it is spawned via the [`Builder`] type,
//! 该类型目前允许你设置线程的名称和栈大小：
//!
//! ```rust
//! # #![allow(unused_must_use)]
//! use std::thread;
//!
//! thread::Builder::new().name("thread1".to_string()).spawn(move || {
//!     println!("Hello, world!");
//! });
//! ```
//!
//! ## The `Thread` type
//!
//! Threads are represented via the [`Thread`] type, which you can get in one of
//! two ways:
//!
//! * By spawning a new thread, e.g., using the [`thread::spawn`][`spawn`]
//!   function, and calling [`thread`][`JoinHandle::thread`] on the [`JoinHandle`].
//! * By requesting the current thread, using the [`thread::current`] function.
//!
//! The [`thread::current`] function is available even for threads not spawned
//! 该模块的 API 没有生成这些线程。
//!
//! ## 线程本地存储
//!
//! 此模块还为 Rust 程序提供了线程本地存储的实现。线程本地存储是一种将数据存储在全局
//! 变量中的方法，程序中的每个线程都会拥有自己的副本。
//! 线程不会共享这些数据，因此访问不需要同步。
//! 线程不共享这些数据，因此访问无需同步。
//!
//! 线程本地键拥有其包含的值，当
//! thread exits. It is created with the [`thread_local!`] macro and can contain any
//! value that is `'static` (no borrowed pointers). It provides an accessor function,
//! [`with`], that yields a shared reference to the value to the specified
//! 闭包提供对值的共享引用。线程本地键仅允许共享访问，因为如果允许可变的借用，则无法保证唯一性。大多数值
//! way to guarantee uniqueness if mutable borrows were allowed. Most values
//! ## 为线程命名
//! [`Cell`] or [`RefCell`] types.
//!
//! ## Naming threads
//!
//! Threads are able to have associated names for identification purposes. By default, spawned
//! threads are unnamed. To specify a name for a thread, build the thread with [`Builder`] and pass
//! the desired thread name to [`Builder::name`]. To retrieve the thread name from within the
//! thread, use [`Thread::name`]. A couple of examples where the name of a thread gets used:
//!
//! 默认栈大小取决于平台并可能发生变化。
//! * The thread name is provided to the OS where applicable (e.g., `pthread_setname_np` in
//! unix-like platforms).
//!
//! ## Stack size
//!
//! The default stack size is platform-dependent and subject to change.
//! 目前，所有 Tier-1 平台上的内存占用为 2 MiB。
//!
//! 有两种手动指定生成线程栈大小的方法：
//!
//! * Build the thread with [`Builder`] and pass the desired stack size to [`Builder::stack_size`].
//! * Set the `RUST_MIN_STACK` environment variable to an integer representing the desired stack
//!   size (in bytes). Note that setting [`Builder::stack_size`] will override this. Be aware that
//!   changes to `RUST_MIN_STACK` may be ignored after program start.
//!
//! 请注意，主线程的栈大小并非由 Rust 决定。
//!
//! [channels]: crate::sync::mpsc
//! [`Arc`]: crate::sync::Arc
//! [`join`]: JoinHandle::join
//! [`Result`]: crate::result::Result
//! [`Ok`]: crate::result::Result::Ok
//! [`Err`]: crate::result::Result::Err
//! [`thread::current`]: current::current
//! [`thread::Result`]: Result
//! [`unpark`]: Thread::unpark
//! [`thread::park_timeout`]: park_timeout
//! [`Cell`]: crate::cell::Cell
//! [`RefCell`]: crate::cell::RefCell
//! [`with`]: LocalKey::with
//! [`thread_local!`]: crate::thread_local

#![stable(feature = "rust1", since = "1.0.0")]
#![deny(unsafe_op_in_unsafe_fn)]
// Under `test`, `__FastLocalKeyInner` seems unused.
#![cfg_attr(test, allow(dead_code))]

use crate::any::Any;

#[macro_use]
mod local;
mod builder;
mod current;
mod functions;
mod id;
mod join_handle;
mod lifecycle;
mod scoped;
mod spawnhook;
mod thread;

pub(crate) mod main_thread;

#[cfg(all(test, not(any(target_os = "emscripten", target_os = "wasi"))))]
mod tests;

#[stable(feature = "rust1", since = "1.0.0")]
pub use builder::Builder;
#[stable(feature = "rust1", since = "1.0.0")]
pub use current::current;
#[unstable(feature = "current_thread_id", issue = "147194")]
pub use current::current_id;
pub(crate) use current::{current_or_unnamed, current_os_id, drop_current, with_current_name};
#[stable(feature = "available_parallelism", since = "1.59.0")]
pub use functions::available_parallelism;
#[stable(feature = "park_timeout", since = "1.4.0")]
pub use functions::park_timeout;
#[stable(feature = "thread_sleep", since = "1.4.0")]
pub use functions::sleep;
#[unstable(feature = "thread_sleep_until", issue = "113752")]
pub use functions::sleep_until;
#[expect(deprecated)]
#[stable(feature = "rust1", since = "1.0.0")]
pub use functions::{panicking, park, park_timeout_ms, sleep_ms, spawn, yield_now};
#[stable(feature = "thread_id", since = "1.19.0")]
pub use id::ThreadId;
#[stable(feature = "rust1", since = "1.0.0")]
pub use join_handle::JoinHandle;
pub(crate) use lifecycle::ThreadInit;
#[stable(feature = "rust1", since = "1.0.0")]
pub use local::{AccessError, LocalKey};
#[stable(feature = "scoped_threads", since = "1.63.0")]
pub use scoped::{Scope, ScopedJoinHandle, scope};
#[unstable(feature = "thread_spawn_hook", issue = "132951")]
pub use spawnhook::add_spawn_hook;
#[stable(feature = "rust1", since = "1.0.0")]
pub use thread::Thread;

// Implementation details used by the thread_local!{} macro.
#[doc(hidden)]
#[unstable(feature = "thread_local_internals", issue = "none")]
pub mod local_impl {
    pub use super::local::thread_local_process_attrs;
    pub use crate::sys::thread_local::*;
}

/// A specialized [`Result`] type for threads.
///
/// 表示线程退出方式。
///
/// The value contained in the `Result::Err` variant
/// 就是线程发生 panic 时使用的消息；
/// that is, the argument the `panic!` macro was called with.
/// 与常规错误不同，该值不实现
/// the [`Error`](crate::error::Error) trait.
///
/// 因此，处理线程 panic 的合理方式要么是：
///
/// 1. propagate the panic with [`std::panic::resume_unwind`]
/// 2. 或者如果线程旨在作为子系统边界，
/// 即用于隔离系统级故障，
/// match on the `Err` variant and handle the panic in an appropriate way
///
/// 未发生 panic 的线程被视为成功退出。
///
/// # 示例
///
/// 根据合并线程的结果进行匹配：
///
/// ```no_run
/// use std::{fs, thread, panic};
///
/// fn copy_in_thread() -> thread::Result<()> {
///     thread::spawn(|| {
///         fs::copy("foo.txt", "bar.txt").unwrap();
///     }).join()
/// }
///
/// fn main() {
///     match copy_in_thread() {
///         Ok(_) => println!("copy succeeded"),
///         Err(e) => panic::resume_unwind(e),
///     }
/// }
/// ```
///
/// [`Result`]: crate::result::Result
/// [`std::panic::resume_unwind`]: crate::panic::resume_unwind
#[stable(feature = "rust1", since = "1.0.0")]
#[doc(search_unbox)]
pub type Result<T> = crate::result::Result<T, Box<dyn Any + Send + 'static>>;

fn _assert_sync_and_send() {
    fn _assert_both<T: Send + Sync>() {}
    _assert_both::<JoinHandle<()>>();
    _assert_both::<Thread>();
}
