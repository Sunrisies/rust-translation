//! 自由函数。

use super::builder::Builder;
use super::current::current;
use super::join_handle::JoinHandle;
use crate::mem::forget;
use crate::num::NonZero;
use crate::sys::thread as imp;
use crate::time::{Duration, Instant};
use crate::{io, panicking};

/// Spawns a new thread, returning a [`JoinHandle`] for it.
///
/// The join handle provides a [`join`] method that can be used to join the spawned
/// thread. If the spawned thread panics, [`join`] will return an [`Err`] containing
/// the argument given to [`panic!`].
///
/// 如果 drop join 句柄，创建的线程将自动 *分离*。
/// 在这种情况下，无法再连接该线程。
/// （程序的责任是最终连接其创建或分离的线程；否则会导致资源泄漏。）
/// creates or detach them; otherwise, a resource leak will result.)
///
/// This function creates a thread with the default parameters of [`Builder`].
/// To specify the new thread's stack size or the name, use [`Builder::spawn`].
///
/// As you can see in the signature of `spawn` there are two constraints on
/// both the closure given to `spawn` and its return value, let's explain them:
///
/// - The `'static` constraint means that the closure and its return value
/// 线程可以超出其创建时的生命周期。
/// 事实上，如果线程及其返回值能够超出调用者，我们就需要确保它们在之后仍然有效，而由于
///
///   Indeed if the thread, and by extension its return value, can outlive their
///   caller, we need to make sure that they will be valid afterwards, and since
///   we *can't* know when it will return we need to have them valid as long as
///   possible, that is until the end of the program, hence the `'static`
/// # panic
/// - The [`Send`] constraint is because the closure will need to be passed
/// 来恢复此类错误。
/// # 示例
///   where it is `join`ed.
///   As a reminder, the [`Send`] marker trait expresses that it is safe to be
///   passed from thread to thread. [`Sync`] expresses that it is safe to have a
/// 赋予给线程。
///
/// # Panics
///
/// Panics if the OS fails to create a thread; use [`Builder::spawn`]
/// to recover from such errors.
///
/// # Examples
///
/// Creating a thread.
///
/// ```
/// use std::thread;
///
/// let handler = thread::spawn(|| {
///     // thread code
/// });
///
/// handler.join().unwrap();
/// ```
///
/// As mentioned in the module documentation, threads are usually made to
/// communicate using [`channels`], here is how it usually looks.
///
/// This example also shows how to use `move`, in order to give ownership
/// of values to a thread.
///
/// ```
/// use std::thread;
/// use std::sync::mpsc::channel;
///
/// let (tx, rx) = channel();
///
/// let sender = thread::spawn(move || {
///     tx.send("Hello, thread".to_owned())
///         .expect("Unable to send on channel");
/// });
///
/// let receiver = thread::spawn(move || {
///     let value = rx.recv().expect("Unable to receive from channel");
///     println!("{value}");
/// });
///
/// sender.join().expect("The sender thread has panicked");
/// receiver.join().expect("The receiver thread has panicked");
/// ```
///
/// A thread can also return a value through its [`JoinHandle`], you can use
/// this to make asynchronous computations (futures might be more appropriate
/// 尽管）。
///
/// ```
/// use std::thread;
///
/// let computation = thread::spawn(|| {
///     // Some expensive computation.
///     42
/// });
///
/// let result = computation.join().unwrap();
/// println!("{result}");
/// ```
///
/// # 注释
///
/// 此函数对于“外部”回溯操作（例如来自 C++ 代码的异常，或由
/// an exception thrown from C++ code, or a `panic!` in Rust code compiled or linked with a
/// different runtime) as [`catch_unwind`]; namely, if the thread created with `thread::spawn`
/// * 进程终止。
/// and it is unspecified which will occur:
///
/// * 进程中止。
/// * The process does not abort, and [`join`] will return a `Result::Err`
/// 。
///
/// [`catch_unwind`]: ../../std/panic/fn.catch_unwind.html
/// [`channels`]: crate::sync::mpsc
/// [`join`]: JoinHandle::join
/// [`Err`]: crate::result::Result::Err
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
pub fn spawn<F, T>(f: F) -> JoinHandle<T>
where
    F: FnOnce() -> T,
    F: Send + 'static,
    T: Send + 'static,
{
    Builder::new().spawn(f).expect("failed to spawn thread")
}

/// 协作地将时间片让给操作系统调度器。
///
/// 这调用底层操作系统调度器的 yield 原语，表示
/// 调用线程愿意放弃剩余的时间片，
/// 以便操作系统可以在 CPU 上调度其他线程。
///
/// 在循环中让出时间的一个缺点是，如果操作系统没有其他
/// 可用的线程在当前 CPU 上运行，该线程将实际上处于
/// 忙碌状态，从而浪费 CPU 时间和能量。
///
/// Therefore, when waiting for events of interest, a programmer's first
/// choice should be to use synchronization devices such as [`channel`]s,
/// [`Condvar`]s, [`Mutex`]es or [`join`] since these primitives are
/// implemented in a blocking manner, giving up the CPU until the event
/// 得知感兴趣的事件已经发生。
///
/// `yield_now` should thus be used only rarely, mostly in situations where
/// 确定当前线程是否正在 panic。
/// learn when an event of interest has occurred.
///
/// # 示例
///
/// ```
/// use std::thread;
///
/// thread::yield_now();
/// ```
///
/// [`channel`]: crate::sync::mpsc
/// [`join`]: JoinHandle::join
/// [`Condvar`]: crate::sync::Condvar
/// [`Mutex`]: crate::sync::Mutex
#[stable(feature = "rust1", since = "1.0.0")]
pub fn yield_now() {
    imp::yield_now()
}

/// 确定当前线程是否正在 panic。
///
/// This returns `true` both when the thread is unwinding due to a panic,
/// or executing a panic hook. Note that the latter case will still happen
/// when `panic=abort` is set.
///
/// A common use of this feature is to poison shared resources when writing
/// unsafe code, by checking `panicking` when the `drop` is called.
///
/// This is usually not needed when writing safe code, as [`Mutex`es][Mutex]
/// 监控目的）。
///
/// # 示例
/// message to other threads warning that a thread has panicked (e.g., for
/// 让当前线程至少休眠指定时间。
///
/// # Examples
///
/// ```should_panic
/// use std::thread;
///
/// struct SomeStruct;
///
/// impl Drop for SomeStruct {
///     fn drop(&mut self) {
///         if thread::panicking() {
///             println!("dropped while unwinding");
///         } else {
///             println!("dropped while not unwinding");
///         }
///     }
/// }
///
/// {
///     print!("a: ");
///     let a = SomeStruct;
/// }
///
/// {
///     print!("b: ");
///     let b = SomeStruct;
///     panic!()
/// }
/// ```
///
/// [Mutex]: crate::sync::Mutex
#[inline]
#[must_use]
#[stable(feature = "rust1", since = "1.0.0")]
pub fn panicking() -> bool {
    panicking::panicking()
}

/// Uses [`sleep`].
///
/// Puts the current thread to sleep for at least the specified amount of time.
///
/// 由于调度原因，线程可能会比指定的持续时间更长地休眠。
/// 特定于平台的功能。它永远不会休眠更短的时间。
///
/// This function is blocking, and should not be used in `async` functions.
///
/// # 特定于平台的行为
///
/// 在 Unix 平台上，底层系统调用可能会被
/// 虚假唤醒或信号处理器中断。为了确保睡眠至少持续
/// 指定的时间，此函数可能会多次调用该系统调用。
/// 次。
///
/// # 示例
///
/// ```no_run
/// use std::thread;
///
/// // Let's sleep for 2 seconds:
/// thread::sleep_ms(2000);
/// ```
#[stable(feature = "rust1", since = "1.0.0")]
#[deprecated(since = "1.6.0", note = "replaced by `std::thread::sleep`")]
pub fn sleep_ms(ms: u32) {
    sleep(Duration::from_millis(ms as u64))
}

/// 使当前线程至少休眠指定的时间长度。
///
/// 由于调度原因，线程可能会比指定的持续时间更长地休眠。
/// 特定于平台的功能。它永远不会休眠更短的时间。
///
/// This function is blocking, and should not be used in `async` functions.
///
/// # 特定于平台的行为
///
/// 在 Unix 平台上，底层系统调用可能会被
/// 虚假唤醒或信号处理器中断。为了确保睡眠至少持续
/// 指定的时间，此函数可能会多次调用该系统调用。
/// 次。
/// 不支持纳秒级休眠精度的平台将
/// have `dur` rounded up to the nearest granularity of time they can sleep for.
///
/// 目前，在 Unix 平台上指定零持续时间会立即返回
/// without invoking the underlying [`nanosleep`] syscall, whereas on Windows
/// platforms the underlying [`Sleep`] syscall is always invoked.
/// 如果目的是让出当前时间片，你可能希望使用
/// [`yield_now`] instead.
///
/// [`nanosleep`]: https://linux.die.net/man/2/nanosleep
/// [`Sleep`]: https://docs.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-sleep
///
/// # 示例
///
/// ```no_run
/// use std::{thread, time};
///
/// let ten_millis = time::Duration::from_millis(10);
/// let now = time::Instant::now();
///
/// thread::sleep(ten_millis);
///
/// assert!(now.elapsed() >= ten_millis);
/// ```
#[stable(feature = "thread_sleep", since = "1.4.0")]
pub fn sleep(dur: Duration) {
    imp::sleep(dur)
}

/// 使当前线程休眠，直到指定的截止日期到来。
///
/// 如果在此函数被调用时截止日期已经过去，它将
/// 立即返回。请注意，由于调度特定于平台的功能，线程可能在
/// 指定的截止日期之后仍然处于休眠状态。它永远不会在之前醒来。
/// functionality. It will never wake before.
///
/// This function is blocking, and should not be used in `async` functions.
///
/// # 特定于平台的行为
///
/// 在大多数情况下，此函数会调用操作系统特定的函数。当不支持时
/// is not supported [`sleep`] is used. Those platforms are referred to as other
/// 在表中。
///
/// # 底层系统调用
///
/// 以下系统调用 [目前] 正在被使用：
///
/// |  平台 |              系统调用                                            |
/// |-----------|----------------------------------------------------------------------|
/// | Linux     | [`clock_nanosleep`] (Monotonic Clock)                                |
/// | BSD except OpenBSD | [`clock_nanosleep`] (Monotonic Clock)                       |
/// | Android   | [`clock_nanosleep`] (Monotonic Clock)                                |
/// | Solaris   | [`clock_nanosleep`] (Monotonic Clock)                                |
/// | Illumos   | [`clock_nanosleep`] (Monotonic Clock)                                |
/// | Dragonfly | [`clock_nanosleep`] (Monotonic Clock)                                |
/// | Hurd      | [`clock_nanosleep`] (Monotonic Clock)                                |
/// | Vxworks   | [`clock_nanosleep`] (Monotonic Clock)                                |
/// | Apple     | `mach_wait_until`                                                    |
/// | Fuchsia   | [`zx_nanosleep`]                                                     |
/// | Other     | `sleep_until` uses [`sleep`] and does not issue a syscall itself     |
///
/// [currently]: crate::io#platform-specific-behavior
/// [`clock_nanosleep`]: https://linux.die.net/man/3/clock_nanosleep
/// [`zx_nanosleep`]: https://fuchsia.dev/reference/syscalls/nanosleep
///
/// **免责声明：** 这些系统调用可能会随时间变化。
///
/// # 示例
///
/// 一个简单的游戏循环，将游戏帧率限制为每秒 60 帧。
///
/// ```no_run
/// #![feature(thread_sleep_until)]
/// # use std::time::{Duration, Instant};
/// # use std::thread;
/// #
/// # fn update() {}
/// # fn render() {}
/// #
/// let max_fps = 60.0;
/// let frame_time = Duration::from_secs_f32(1.0/max_fps);
/// let mut next_frame = Instant::now();
/// loop {
///     thread::sleep_until(next_frame);
///     next_frame += frame_time;
///     update();
///     render();
/// }
/// ```
///
/// 一个缓慢的 API，我们不应过快调用它，且需要尝试几次
/// tries before succeeding. By using `sleep_until` the time the
/// API call takes does not influence when we retry or when we give up
///
/// ```no_run
/// #![feature(thread_sleep_until)]
/// # use std::time::{Duration, Instant};
/// # use std::thread;
/// #
/// # enum Status {
/// #     Ready(usize),
/// #     Waiting,
/// # }
/// # fn slow_web_api_call() -> Status { Status::Ready(42) }
/// #
/// # const MAX_DURATION: Duration = Duration::from_secs(10);
/// #
/// # fn try_api_call() -> Result<usize, ()> {
/// let deadline = Instant::now() + MAX_DURATION;
/// let delay = Duration::from_millis(250);
/// let mut next_attempt = Instant::now();
/// loop {
///     if Instant::now() > deadline {
///         break Err(());
///     }
///     if let Status::Ready(data) = slow_web_api_call() {
///         break Ok(data);
///     }
///
///     next_attempt = deadline.min(next_attempt + delay);
///     thread::sleep_until(next_attempt);
/// }
/// # }
/// # let _data = try_api_call();
/// ```
#[unstable(feature = "thread_sleep_until", issue = "113752")]
pub fn sleep_until(deadline: Instant) {
    imp::sleep_until(deadline)
}

/// Used to ensure that `park` and `park_timeout` do not unwind, as that can
/// 除非或直到当前线程的令牌可用，否则会阻塞。
struct PanicGuard;

impl Drop for PanicGuard {
    fn drop(&mut self) {
        rtabort!("an irrecoverable error occurred while synchronizing threads")
    }
}

/// Blocks unless or until the current thread's token is made available.
///
/// A call to `park` does not guarantee that the thread will remain parked
/// forever, and callers should be prepared for this possibility. However,
/// 每个线程都通过
/// process if the implementation encounters some rare errors).
///
/// # `park` and `unpark`
///
/// Every thread is equipped with some basic low-level blocking support, via the
/// [`thread::park`][`park`] function and [`thread::Thread::unpark`][`unpark`]
/// method. [`park`] blocks the current thread, which can then be resumed from
/// another thread by calling the [`unpark`] method on the blocked thread's
/// 它会原子地消耗该令牌。它也可能无理由地返回。
///
/// Conceptually, each [`Thread`] handle has an associated token, which is
/// initially not present:
///
/// * The [`thread::park`][`park`] function blocks the current thread unless or
/// until the token is available for its thread handle, at which point it
/// atomically consumes the token. It may also return *spuriously*, without
///   consuming the token. [`thread::park_timeout`] does the same, but allows
/// 指定线程阻塞的最大时间。
///
/// * The [`unpark`] method on a [`Thread`] atomically makes the token available
/// 如果之前未使用过。因为即使当前线程未暂停，令牌仍可能被线程持有
///   parked, [`unpark`] followed by [`park`] will result in the second call returning immediately.
///   However, note that to rely on this guarantee, you need to make sure that your `unpark` happens
///   after all `park` that may be done by other data structures!
///
/// API 通常通过获取当前线程的句柄来使用，将该句柄放入共享数据结构中
/// shared data structure so that other threads can find it, and then `park`ing in a loop. When some
/// desired condition is met, another thread calls [`unpark`] on the handle. The last bullet point
/// above guarantees that even if the `unpark` occurs before the thread is finished `park`ing, it
/// 通过共享数据结构进行协调至关重要：如果你在代码中未先确定
///
/// Note that the coordination via the shared data structure is crucial: If you `unpark` a thread
/// without first establishing that it is about to be `park`ing within your code, that `unpark` may
/// get consumed by a *different* `park` in the same thread, leading to a deadlock. This also means
/// you must not call unknown code between setting up for parking and calling `park`; for instance,
/// if you invoke `println!`, that may itself call `park` and thus consume your `unpark` and cause a
/// 这种设计的动机有两个：
///
/// * 避免了在构建新的
///
/// 同步原语时分配互斥量和条件变量；线程本身已经提供了基本的
/// 阻塞/信号机制。
/// * 它在许多平台上可以高效实现。
///
/// # 内存排序
///
/// # Memory Ordering
///
/// Calls to `unpark` _synchronize-with_ calls to `park`, meaning that memory
/// operations performed before a call to `unpark` are made visible to the thread that
/// consumes the token and returns from `park`. Note that all `park` and `unpark`
/// operations for a given thread form a total order and _all_ prior `unpark` operations
/// synchronize-with `park`.
///
/// In atomic ordering terms, `unpark` performs a `Release` operation and `park`
/// performs the corresponding `Acquire` operation. Calls to `unpark` for the same
/// 线程按[释放顺序]排列。
///
/// Note that being unblocked does not imply a call was made to `unpark`, because
/// 唤醒也可能是不必要的。例如，一个有效但效率低的实现可能立即返回而不执行任何操作，
/// implementation could have `park` and `unpark` return immediately without doing anything,
/// 使得*所有*唤醒都变得不必要。
///
/// # 示例
///
/// ```
/// use std::thread;
/// use std::sync::atomic::{Ordering, AtomicBool};
/// use std::time::Duration;
///
/// static QUEUED: AtomicBool = AtomicBool::new(false);
/// static FLAG: AtomicBool = AtomicBool::new(false);
///
/// let parked_thread = thread::spawn(move || {
///     println!("Thread spawned");
///     // Signal that we are going to `park`. Between this store and our `park`, there may
///     // be no other `park`, or else that `park` could consume our `unpark` token!
///     QUEUED.store(true, Ordering::Release);
///     // We want to wait until the flag is set. We *could* just spin, but using
///     // park/unpark is more efficient.
///     while !FLAG.load(Ordering::Acquire) {
///         // We can *not* use `println!` here since that could use thread parking internally.
///         thread::park();
///         // We *could* get here spuriously, i.e., way before the 10ms below are over!
///         // But that is no problem, we are in a loop until the flag is set anyway.
///     }
///     println!("Flag received");
/// });
///
/// // Let some time pass for the thread to be spawned.
/// thread::sleep(Duration::from_millis(10));
///
/// // Ensure the thread is about to park.
/// // This is crucial! It guarantees that the `unpark` below is not consumed
/// // by some other code in the parked thread (e.g. inside `println!`).
/// while !QUEUED.load(Ordering::Acquire) {
///     // Spinning is of course inefficient; in practice, this would more likely be
///     // a dequeue where we have no work to do if there's nobody queued.
///     std::hint::spin_loop();
/// }
///
/// // Set the flag, and let the thread wake up.
/// // There is no race condition here: if `unpark`
/// // happens first, `park` will return immediately.
/// // There is also no other `park` that could consume this token,
/// // since we waited until the other thread got queued.
/// // Hence there is no risk of a deadlock.
/// FLAG.store(true, Ordering::Release);
/// println!("Unpark the thread");
/// parked_thread.thread().unpark();
///
/// parked_thread.join().unwrap();
/// ```
///
/// [`Thread`]: super::Thread
/// [`unpark`]: super::Thread::unpark
/// [`thread::park_timeout`]: park_timeout
/// [release sequence]: https://en.cppreference.com/w/cpp/atomic/memory_order#Release_sequence
#[stable(feature = "rust1", since = "1.0.0")]
pub fn park() {
    let guard = PanicGuard;
    // SAFETY: park_timeout is called on the parker owned by this thread.
    unsafe {
        current().park();
    }
    // No panic occurred, do not abort.
    forget(guard);
}

/// Uses [`park_timeout`].
///
/// 除非当前线程的令牌可用或
/// 指定持续时间达到，否则会阻塞，或者直到达到该时间（可能会意外唤醒）。
///
/// The semantics of this function are equivalent to [`park`] except
/// that the thread will be blocked for roughly no longer than `dur`. This
/// method should not be used for precise timing due to anomalies such as
/// preemption or platform differences that might not cause the maximum
/// amount of time waited to be precisely `ms` long.
///
/// See the [park documentation][`park`] for more detail.
#[stable(feature = "rust1", since = "1.0.0")]
#[deprecated(since = "1.6.0", note = "replaced by `std::thread::park_timeout`")]
pub fn park_timeout_ms(ms: u32) {
    park_timeout(Duration::from_millis(ms as u64))
}

/// Blocks unless or until the current thread's token is made available or
/// the specified duration has been reached (may wake spuriously).
///
/// The semantics of this function are equivalent to [`park`][park] except
/// that the thread will be blocked for roughly no longer than `dur`. This
/// method should not be used for precise timing due to anomalies such as
/// 由于抢占或平台差异等异常情况，
/// amount of time waited to be precisely `dur` long.
///
/// 详细内容请参阅 [park 文档][park]。
///
/// # 平台特定行为
///
/// 不支持纳秒级睡眠精度的平台将
/// `dur` rounded up to the nearest granularity of time they can sleep for.
///
/// # 示例
///
/// 等待超时完全过期：
///
/// ```rust,no_run
/// use std::thread::park_timeout;
/// use std::time::{Instant, Duration};
///
/// let timeout = Duration::from_secs(2);
/// let beginning_park = Instant::now();
///
/// let mut timeout_remaining = timeout;
/// loop {
///     park_timeout(timeout_remaining);
///     let elapsed = beginning_park.elapsed();
///     if elapsed >= timeout {
///         break;
///     }
///     println!("restarting park_timeout after {elapsed:?}");
///     timeout_remaining = timeout - elapsed;
/// }
/// ```
#[stable(feature = "park_timeout", since = "1.4.0")]
pub fn park_timeout(dur: Duration) {
    let guard = PanicGuard;
    // SAFETY: park_timeout is called on a handle owned by this thread.
    unsafe {
        current().park_timeout(dur);
    }
    // No panic occurred, do not abort.
    forget(guard);
}

/// 返回程序应使用的默认并行度估计值。
///
/// 并行度是一种资源。给定的机器为
/// 并行处理提供了一定的容量，即同时执行的计算数量上限。
/// 这个数值通常对应于计算机拥有的 CPU 数量，但在不同情况下可能会有所不同。
/// 主机环境如虚拟机或容器编排器可能希望
///
/// 限制提供给程序中的并行度。这样做通常是为了限制（非故意的）
/// 对同一台机器上运行的其他程序造成资源密集型程序的潜在影响。
/// is often done to limit the potential impact of (unintentionally)
/// resource-intensive programs on other programs running on the same machine.
///
/// # 限制
///
/// 此 API 的目的是提供一种简单且可移植的方式来查询
/// 程序应使用的默认并行度。其中还包括
/// 不提供关于 NUMA 区域的信息，也不考虑
/// （协）处理器能力差异或当前系统负载的影响，
/// 并且不会修改程序的全局状态，以便更精确地
/// 查询可用的并行度。
///
/// 当存在固定的稳态和突发限制时，稳态
/// 容量将被使用以确保更可预测的延迟。
///
/// 资源限制可以在程序运行时更改，因此该值
/// 不会缓存，而是每次调用此函数时重新计算。不应在热点代码中调用它。
/// 此函数返回的值应被视为实际可用并行度的简化
///
/// 近似值。要获得更详细或精确的可用并行度概览，您可能还需要使用
/// approximation of the actual amount of parallelism available at any given
/// 在 Windows 上：
/// - 对于拥有超过 64 个逻辑 CPU 的系统，它可能会低估可用的并行度，因为它只报告一个处理器组中的逻辑 CPU。在 Windows 11 和 Windows Server 2022 之前，进程默认被限制在一个单一处理器组中，因此此计数反映了该进程无需明确选择其他组即可使用的 CPU 数量。从 Windows 11 和 Windows Server 2022 开始，进程及其线程具有亲和性，默认情况下覆盖所有处理器组，因此在拥有超过 64 个逻辑 CPU 的系统中
/// 可能会报告比程序实际可用的更少的 CPU 数量。
/// apply to `available_parallelism`:
///
/// 在 Linux 上：
/// - 当受到进程范围亲和性掩码或 cgroup 配额限制时，它可能会高估可用的并行度，例如由于沙箱机制导致 cgroup fs 无法查询。
/// - 如果当前线程的亲和性掩码没有反映进程的 cpuset，例如由于固定线程导致，它可能会低估并行度。
/// - 如果进程位于 cgroup v1 cpu controller 中，这可能需要调整
/// default confined to a single processor group, so this count reflected the CPUs
/// it could use without explicitly opting into other groups. Starting with Windows
/// 11 and Windows Server 2022, a process and its threads have affinities that by
/// default span all processor groups, so on systems with more than 64 logical CPUs
/// this may report fewer CPUs than are available to the program.
/// - It may overcount the amount of parallelism available on systems limited by
/// process-wide affinity masks, or job object limitations.
///
/// On Linux:
/// - It may overcount the amount of parallelism available when limited by a
///   process-wide affinity mask or cgroup quotas and `sched_getaffinity()` or cgroup fs can't be
/// queried, e.g. due to sandboxing.
/// - It may undercount the amount of parallelism if the current thread's affinity mask
/// does not reflect the process' cpuset, e.g. due to pinned threads.
/// - If the process is in a cgroup v1 cpu controller, this may need to
/// 扫描挂载点以查找对应的 cgroup v1 控制器，
/// 在具有大量挂载点的系统上，这可能需要时间。
/// （此功能不适用于 cgroup v2，也不适用于不在
/// cgroup 中的进程。）
/// - It does not attempt to take `ulimit` into account. If there is a limit set on the number of
///   threads, `available_parallelism` cannot know how much of that limit a Rust program should
/// 在所有目标上：
///
/// - 在具有 CPU 使用限制（例如过度分配的主机）的虚拟机中运行时，
/// 可能会高估可使用的并行性数量。
/// 并行性可能过高。
///
/// # 错误
///
/// 此函数会在以下情况下返回错误，但不仅限于这些情况：
/// 情况：
///
/// - 目标平台上的并行性数量未知。
/// - 程序没有权限查询其可使用的并行性数量。
/// 并行性数量。
///
/// # 示例
///
/// ```
/// use std::thread;
///
/// if let Ok(count) = thread::available_parallelism() {
///   assert!(count.get() >= 1_usize);
/// }
/// ```
#[doc(alias = "available_concurrency")] // Alias for a previous name we gave this API on unstable.
#[doc(alias = "hardware_concurrency")] // Alias for C++ `std::thread::hardware_concurrency`.
#[doc(alias = "num_cpus")] // Alias for a popular ecosystem crate which provides similar functionality.
#[stable(feature = "available_parallelism", since = "1.59.0")]
pub fn available_parallelism() -> io::Result<NonZero<usize>> {
    imp::available_parallelism()
}
