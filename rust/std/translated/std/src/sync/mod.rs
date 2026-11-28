//! 有用的同步原语。
//!
//! ## 对同步的需求
//!
//! 从概念上讲，Rust 程序是一系列将在
//! 计算机上执行的操作。程序中发生的事件顺序与代码中的操作顺序一致。
//! 考虑以下操作某些全局静态变量的代码：
//!
//! 似乎内存中存储的一些变量被修改了，进行了加法操作，
//!
//! ```rust
//! // FIXME(static_mut_refs): use raw pointers instead of references
//! #![allow(static_mut_refs)]
//!
//! static mut A: u32 = 0;
//! static mut B: u32 = 0;
//! static mut C: u32 = 0;
//!
//! fn main() {
//!     unsafe {
//!         A = 3;
//!         B = 4;
//!         A = A + B;
//!         C = B;
//!         println!("{A} {B} {C}");
//!         C = A;
//!     }
//! }
//! ```
//!
//! It appears as if some variables stored in memory are changed, an addition
//! is performed, result is stored in `A` and the variable `C` is
//! 当只有单个线程参与时，结果如预期：
//!
//! When only a single thread is involved, the results are as expected:
//! the line `7 4 4` gets printed.
//!
//! As for what happens behind the scenes, when optimizations are enabled the
//! final generated machine code might look very different from the code:
//!
//! - The first store to `C` might be moved before the store to `A` or `B`,
//!   _as if_ we had written `C = 4; A = 3; B = 4`.
//!
//! - Assignment of `A + B` to `A` might be removed, since the sum can be stored
//!   in a temporary location until it gets printed, with the global variable
//! 编译器可以执行这些优化中的任意组合，只要最终优化的代码在运行时
//!
//! 能产生与未优化代码相同的结果。
//! 由于现代计算机涉及 [并发]，关于程序执行顺序的假设往往是错误的。即使
//!   block into a simple `println!("7 4 4")`.
//!
//! 引入同步错误。
//! 请注意，得益于 Rust 的安全保证，如果不在本模块中使用任何同步原语，
//! produces the same results as the one without optimizations.
//!
//! ## 顺序错乱的执行
//! 由于各种原因，指令的执行顺序可能与我们定义的顺序不同：
//! - **编译器** 对指令的重新排序：如果编译器可以在更早的时间发出指令，它就会尝试这样做。例如，它可能将内存加载操作移到代码块的最顶部，以便 CPU 开始从内存中[预取]值。
//! compiler optimizations are disabled, and it is **still possible**
//! to introduce synchronization bugs.
//!
//! Note that thanks to Rust's safety guarantees, accessing global (static)
//! variables requires `unsafe` code, assuming we don't use any of the
//! synchronization primitives in this module.
//!
//! [constant folding]: https://en.wikipedia.org/wiki/Constant_folding
//! [concurrency]: https://en.wikipedia.org/wiki/Concurrency_(computer_science)
//!
//! ## Out-of-order execution
//!
//! Instructions can execute in a different order from the one we define, due to
//! various reasons:
//!
//! - The **compiler** reordering instructions: If the compiler can issue an
//! instruction at an earlier point, it will try to do so. For example, it
//! might hoist memory loads at the top of a code block, so that the CPU can
//! start [prefetching] the values from memory.
//!
//! 在单线程场景中，这可能会在编写
//! 信号处理器或某些低级代码时引发问题。
//! 使用 [编译器围栏] 来防止这种重新排序。
//!
//! - 一个 **单处理器** 按[乱序]执行指令：
//! 现代 CPU 能够支持[超线程]执行，
//! 即多个指令可能同时执行，
//! 即使机器代码描述的是顺序过程。
//!
//! 这种重新排序由 CPU 透明地处理。
//!
//! - 一个 **多处理器** 系统同时执行多个硬件线程：
//! 在多线程场景中，你可以使用两种
//! 类型的原语来处理同步：
//! - [内存围栏] 以确保内存访问按正确顺序被
//! 其他 CPU 看到。
//! - [原子操作] 以确保同时访问同一
//! 内存位置不会导致未定义行为。
//!
//! [prefetching]: https://en.wikipedia.org/wiki/Cache_prefetching
//! [compiler fences]: crate::sync::atomic::compiler_fence
//! [out-of-order]: https://en.wikipedia.org/wiki/Out-of-order_execution
//! [superscalar]: https://en.wikipedia.org/wiki/Superscalar_processor
//! [memory fences]: crate::sync::atomic::fence
//! [atomic operations]: crate::sync::atomic
//!
//! ## 更高层次的同步对象
//!
//! 大多数低级同步原语都相当容易出错且
//! 使用不便，因此标准库也提供了一些
//! 更高层次的同步对象。
//!
//! 这些抽象概念可以由低级原语构建出来。
//! 为了效率，标准库中的同步对象通常
//! 由操作系统内核帮助实现，该内核能够在线程获取
//! 锁时阻塞时重新安排线程。
//! 以下是对可用同步
//!
//! 对象的概述：
//! objects:
//!
//! - [`Arc`]: Atomically Reference-Counted pointer, which can be used
//! 数据的生命周期，直到所有线程使用完毕。
//!   data until all the threads have finished using it.
//!
//! - [`Barrier`]: Ensures multiple threads will wait for each other
//!   to reach a point in the program, before continuing execution all
//! 阻塞。
//!
//! - [`Condvar`]: Condition Variable, providing the ability to block
//! 基于消息的通信。可以提供轻量级的
//!
//! - [`mpsc`]: Multi-producer, single-consumer queues, used for
//! 额外内存。
//!   inter-thread synchronisation mechanism, at the cost of some
//! 基于消息的通信。可以提供轻量级的
//!
//! - [`mpmc`]: Multi-producer, multi-consumer queues, used for
//! message-based communication. Can provide a lightweight
//! inter-thread synchronisation mechanism, at the cost of some
//! 额外内存。
//!
//! - [`Mutex`]: Mutual Exclusion mechanism, which ensures that at
//! 一次最多只有一个线程能够访问某些数据。
//!
//! - [`Once`]: Used for a thread-safe, one-time global initialization routine.
//!   Mostly useful for implementing other types like [`OnceLock`].
//!
//! - [`OnceLock`]: Used for thread-safe, one-time initialization of a
//!   variable, with potentially different initializers based on the caller.
//!
//! - [`LazyLock`]: Used for thread-safe, one-time initialization of a
//! 变量初始化。
//!
//! - [`RwLock`]: Provides a mutual exclusion mechanism which allows
//! 同时有多个读取者，但只允许一个写入者。在某些情况下，这比
//! mutex 更高效。
//! ## 阻塞保证
//!
//! [`Arc`]: crate::sync::Arc
//! [`Barrier`]: crate::sync::Barrier
//! [`Condvar`]: crate::sync::Condvar
//! [`mpmc`]: crate::sync::mpmc
//! [`mpsc`]: crate::sync::mpsc
//! [`Mutex`]: crate::sync::Mutex
//! [`Once`]: crate::sync::Once
//! [`OnceLock`]: crate::sync::OnceLock
//! [`RwLock`]: crate::sync::RwLock
//!
//! ## 阻塞保证
//!
//! 被标注为不阻塞的方法永远不会无限期地阻塞。
//! 也就是说，它们可能通过平台原语内部阻塞，但仍然“表现”为非阻塞。这种差异对大多数程序是不可见的。
//!
//! 这仅对禁止阻塞的平台有意义，例如主线程上的多线程 WebAssembly。
//! None of the implementations in `std::sync` are guaranteed to be (or remain) non-blocking in this regard.

#![stable(feature = "rust1", since = "1.0.0")]

// No formatting: this file is just re-exports, and their order is worth preserving.
#![cfg_attr(rustfmt, rustfmt::skip)]

// These come from `core` & `alloc` and only in one flavor: no poisoning.
#[stable(feature = "exclusive_wrapper", since = "1.101.0")]
pub use core::sync::SyncView;
#[stable(feature = "rust1", since = "1.0.0")]
pub use core::sync::atomic;

#[unstable(feature = "unique_rc_arc", issue = "112566")]
pub use alloc_crate::sync::UniqueArc;
#[stable(feature = "rust1", since = "1.0.0")]
pub use alloc_crate::sync::{Arc, Weak};

#[unstable(feature = "mpmc_channel", issue = "126840")]
pub mod mpmc;
pub mod mpsc;
#[unstable(feature = "oneshot_channel", issue = "143674")]
pub mod oneshot;

pub(crate) mod once; // `pub(crate)` for the `sys::sync::once` implementations and `LazyLock`.

#[stable(feature = "rust1", since = "1.0.0")]
pub use self::once::{Once, OnceState};

#[stable(feature = "rust1", since = "1.0.0")]
#[doc(inline)]
#[expect(deprecated)]
pub use self::once::ONCE_INIT;

mod barrier;
mod lazy_lock;
mod once_lock;
mod reentrant_lock;

// These exist only in one flavor: no poisoning.
#[stable(feature = "rust1", since = "1.0.0")]
pub use self::barrier::{Barrier, BarrierWaitResult};
#[stable(feature = "lazy_cell", since = "1.80.0")]
pub use self::lazy_lock::LazyLock;
#[stable(feature = "once_cell", since = "1.70.0")]
pub use self::once_lock::OnceLock;
#[unstable(feature = "reentrant_lock", issue = "121440")]
pub use self::reentrant_lock::{ReentrantLock, ReentrantLockGuard};

// Note: in the future we will change the default version in `std::sync` to the non-poisoning
// version over an edition.
// See https://github.com/rust-lang/rust/issues/134645#issuecomment-3324577500 for more details.

#[unstable(feature = "sync_nonpoison", issue = "134645")]
pub mod nonpoison;
#[unstable(feature = "sync_poison_mod", issue = "134646")]
pub mod poison;

// FIXME(sync_poison_mod): remove all `#[doc(inline)]` once the modules are stabilized.

// These exist only with poisoning.
#[stable(feature = "rust1", since = "1.0.0")]
#[doc(inline)]
pub use self::poison::{LockResult, PoisonError};

// These exist in both flavors: with and without poisoning.
// The historical default is the version with poisoning.
#[stable(feature = "rust1", since = "1.0.0")]
#[doc(inline)]
pub use self::poison::{
    TryLockError, TryLockResult,
    Mutex, MutexGuard,
    RwLock, RwLockReadGuard, RwLockWriteGuard,
    Condvar,
};

#[unstable(feature = "mapped_lock_guards", issue = "117108")]
#[doc(inline)]
pub use self::poison::{MappedMutexGuard, MappedRwLockReadGuard, MappedRwLockWriteGuard};

/// 一种类型，指示对条件变量的定时等待是否因超时而结束。
/// due to a time out or not.
///
/// It is returned by the [`wait_timeout`] method.
///
/// [`wait_timeout`]: Condvar::wait_timeout
#[derive(Debug, PartialEq, Eq, Copy, Clone)]
#[stable(feature = "wait_timeout", since = "1.5.0")]
pub struct WaitTimeoutResult(bool);

impl WaitTimeoutResult {
    /// Returns `true` if the wait was known to have timed out.
    ///
    /// # 示例
    ///
    /// 此示例创建一个线程，该线程将在 20 毫秒后
    /// 更新布尔值并通知 condvar。
    ///
    /// 主线程将在 condvar 上等待 10 毫秒的超时时间，
    /// 并在超时后退出循环。
    ///
    /// ```
    /// use std::sync::{Arc, Condvar, Mutex};
    /// use std::thread;
    /// use std::time::Duration;
    ///
    /// let pair = Arc::new((Mutex::new(false), Condvar::new()));
    /// let pair2 = Arc::clone(&pair);
    ///
    /// # let handle =
    /// thread::spawn(move || {
    ///     let (lock, cvar) = &*pair2;
    ///
    ///     // Let's wait 20 milliseconds before notifying the condvar.
    ///     thread::sleep(Duration::from_millis(20));
    ///
    ///     let mut started = lock.lock().unwrap();
    ///     // We update the boolean value.
    ///     *started = true;
    ///     cvar.notify_one();
    /// });
    ///
    /// // Wait for the thread to start up.
    /// let (lock, cvar) = &*pair;
    /// loop {
    ///     // Let's put a timeout on the condvar's wait.
    ///     let result = cvar.wait_timeout(lock.lock().unwrap(), Duration::from_millis(10)).unwrap();
    ///     // 10 milliseconds have passed.
    ///     if result.1.timed_out() {
    ///         // timed out now and we can leave.
    ///         break
    ///     }
    /// }
    /// # // Prevent leaks for Miri.
    /// # let _ = handle.join();
    /// ```
    #[must_use]
    #[stable(feature = "wait_timeout", since = "1.5.0")]
    pub fn timed_out(&self) -> bool {
        self.0
    }
}
