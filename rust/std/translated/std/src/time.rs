//! 时间量化。
//!
//! # 示例
//!
//! There are multiple ways to create a new [`Duration`]:
//!
//! ```
//! # use std::time::Duration;
//! let five_seconds = Duration::from_secs(5);
//! assert_eq!(five_seconds, Duration::from_millis(5_000));
//! assert_eq!(five_seconds, Duration::from_micros(5_000_000));
//! assert_eq!(five_seconds, Duration::from_nanos(5_000_000_000));
//!
//! let ten_seconds = Duration::from_secs(10);
//! let seven_nanos = Duration::from_nanos(7);
//! let total = ten_seconds + seven_nanos;
//! assert_eq!(total, Duration::new(10, 7));
//! ```
//!
//! Using [`Instant`] to calculate how long a function took to run:
//!
//! ```ignore (incomplete)
//! let now = Instant::now();
//!
//! // Calling a slow function, it may take a while
//! slow_function();
//!
//! let elapsed_time = now.elapsed();
//! println!("Running slow_function() took {} seconds.", elapsed_time.as_secs());
//! ```

#![stable(feature = "time", since = "1.3.0")]

#[stable(feature = "time", since = "1.3.0")]
pub use core::time::Duration;
#[stable(feature = "duration_checked_float", since = "1.66.0")]
pub use core::time::TryFromFloatSecsError;

use crate::error::Error;
use crate::fmt;
use crate::ops::{Add, AddAssign, Sub, SubAssign};
use crate::sys::{FromInner, IntoInner, time};

/// 对单调递增时钟的测量。
/// Opaque and useful only with [`Duration`].
///
/// 时刻总是被保证，除非出现 [平台错误]，否则不会比创建时
/// 之前测量的时刻更短，常用于测量
/// 基准测试或计时操作所花费的时间。
///
/// 不过请注意，时刻**不**保证是**稳定**的。换句话说，
/// 底层时钟的每一次滴答长度可能不同（例如
/// 某些秒长可能比其他秒长）。一个时刻可能会向前跳跃或
/// 经历时间膨胀（变慢或变快），但它永远不会
/// 倒退。
/// 作为这种不保证的一部分，也不明确系统暂停是否
/// 算作经过的时间。行为因平台和 Rust 版本而异。
///
/// 时刻是不透明的类型，只能相互比较。没有方法可以从时刻获取“秒数”。相反，它仅
/// 允许测量两个时刻之间的持续时间（或比较两个
/// 时刻）。
/// instants).
///
/// The size of an `Instant` struct may vary depending on the target operating
/// # 特定于操作系统的行为
///
/// Example:
///
/// ```no_run
/// use std::time::{Duration, Instant};
/// use std::thread::sleep;
///
/// fn main() {
///    let now = Instant::now();
///
///    // we sleep for 2 seconds
///    sleep(Duration::new(2, 0));
///    // it prints '2'
///    println!("{}", now.elapsed().as_secs());
/// }
/// ```
///
/// [platform bugs]: Instant#monotonicity
///
/// # 可能因底层操作系统而异。例如，
///
/// An `Instant` is a wrapper around system-specific types and it may behave
/// 对于跨平台代码，您可以放心使用长达约一百年的持续时间。
/// # 底层系统调用
///
/// ```no_run
/// use std::time::{Instant, Duration};
///
/// let now = Instant::now();
/// let days_per_10_millennia = 365_2425;
/// let solar_seconds_per_day = 60 * 60 * 24;
/// let millennium_in_solar_seconds = 31_556_952_000;
/// assert_eq!(millennium_in_solar_seconds, days_per_10_millennia * solar_seconds_per_day / 10);
///
/// let duration = Duration::new(millennium_in_solar_seconds, 0);
/// println!("{:?}", now + duration);
/// ```
///
/// For cross-platform code, you can comfortably use durations of up to around one hundred years.
///
/// # | 平台 | 系统调用                                      |
///
/// The following system calls are [currently] being used by `now()` to find out
/// the current time:
///
/// |  Platform |               System call                                            |
/// |-----------|----------------------------------------------------------------------|
/// | SGX       | [`insecure_time` usercall]. More information on [timekeeping in SGX] |
/// | UNIX      | [clock_gettime] with `CLOCK_MONOTONIC`                               |
/// | WASI      | [clock_gettime] with `CLOCK_MONOTONIC`                               |
/// | Darwin    | [clock_gettime] with `CLOCK_UPTIME_RAW`                              |
/// | VXWorks   | [clock_gettime] with `CLOCK_MONOTONIC`                               |
/// | SOLID     | `get_tim`                                                            |
/// | Windows   | [QueryPerformanceCounter]                                            |
///
/// [currently]: crate::io#platform-specific-behavior
/// [QueryPerformanceCounter]: https://docs.microsoft.com/en-us/windows/win32/api/profileapi/nf-profileapi-queryperformancecounter
/// [`insecure_time` usercall]: https://edp.fortanix.com/docs/api/fortanix_sgx_abi/struct.Usercalls.html#method.insecure_time
/// [timekeeping in SGX]: https://edp.fortanix.com/docs/concepts/rust-std/#codestdtimecode
/// [clock_gettime]: https://pubs.opengroup.org/onlinepubs/9799919799/functions/clock_getres.html
///
/// **免责声明：**这些系统调用可能会随时间变化。
///
/// > Note: mathematical operations like [`add`] may panic if the underlying
/// >
///
/// [`add`]: Instant::add
///
/// ## 单调性
///
/// On all platforms `Instant` will try to use an OS API that guarantees monotonic behavior
/// 如果可用，所有 [tier 1] 平台都如此。
/// 实际上，在极少数情况下，这种保证会被硬件、虚拟化或操作系统错误破坏。为了应对这些错误以及平台不提供单调时钟的情况，
/// or operating system bugs. To work around these bugs and platforms not offering monotonic clocks
/// [`duration_since`], [`elapsed`] and [`sub`](#impl-Sub-for-Instant) saturate to zero. In older
/// Rust versions this lead to a panic instead. [`checked_duration_since`] can be used to detect and
/// handle situations where monotonicity is violated, or `Instant`s are subtracted in the wrong order.
///
/// 这种解决方案掩盖了编程错误，即早期和晚期时刻被意外交换。因此，未来的 Rust 版本可能会重新引入 panic。
/// 对系统时钟的测量，有助于与
///
/// [tier 1]: https://doc.rust-lang.org/rustc/platform-support.html
/// [`duration_since`]: Instant::duration_since
/// [`elapsed`]: Instant::elapsed
/// [`sub`]: Instant::sub
/// [`checked_duration_since`]: Instant::checked_duration_since
///
#[derive(Copy, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[stable(feature = "time2", since = "1.8.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "Instant")]
pub struct Instant(time::Instant);

/// 外部实体（如文件系统或其他进程）进行通信。
/// external entities like the file system or other processes.
///
/// Distinct from the [`Instant`] type, this time measurement **is not
/// 再将另一个文件保存到文件系统，**第二个文件具有**
/// save another file to the file system, **and the second file has a
/// `SystemTime` measurement earlier than the first**. In other words, an
/// operation that happens after another operation in real time may have an
/// earlier `SystemTime`!
///
/// Consequently, comparing two `SystemTime` instances to learn about the
/// duration between them returns a [`Result`] instead of an infallible [`Duration`]
/// to indicate that this sort of time drift may happen and needs to be handled.
///
/// Although a `SystemTime` cannot be directly inspected, the [`UNIX_EPOCH`]
/// constant is provided in this module as an anchor in time to learn
/// information about a `SystemTime`. By calculating the duration from this
/// fixed point in time, a `SystemTime` can be converted to a human-readable time,
/// 与操作系统的墙钟相同。
///
/// The size of a `SystemTime` struct may vary depending on the target operating
/// system.
///
/// A `SystemTime` does not count leap seconds.
/// `SystemTime::now()`'s behavior around a leap second
/// is the same as the operating system's wall clock.
/// 闰秒附近的精确行为
/// （例如，时钟看起来是变慢、变快、停止还是跳跃）
/// 取决于平台和配置设置，
/// 因此不应依赖此行为。
///
/// 示例：
///
/// ```no_run
/// use std::time::{Duration, SystemTime};
/// use std::thread::sleep;
///
/// fn main() {
///    let now = SystemTime::now();
///
///    // we sleep for 2 seconds
///    sleep(Duration::new(2, 0));
///    match now.elapsed() {
///        Ok(elapsed) => {
///            // it prints '2'
///            println!("{}", elapsed.as_secs());
///        }
///        Err(e) => {
///            // the system clock went backwards!
///            println!("Great Scott! {e:?}");
///        }
///    }
/// }
/// ```
///
/// # 平台特定行为
///
/// The precision of `SystemTime` can depend on the underlying OS-specific time format.
/// 例如，在 Windows 上时间以 100 纳秒为间隔表示，而 Linux
/// 则可以以纳秒为间隔表示。
///
/// The following system calls are [currently] being used by `now()` to find out
/// the current time:
///
/// **免责声明：** 这些系统调用可能会随时间变化。
/// |-----------|----------------------------------------------------------------------|
/// | SGX       | [`insecure_time` usercall]. More information on [timekeeping in SGX] |
/// | UNIX      | [clock_gettime (Realtime Clock)]                                     |
/// 用于了解系统时间偏离正方向的程度。
/// # 示例
/// 返回与“现在”对应的瞬间。
/// | SOLID     | `SOLID_RTC_ReadTime`                                                 |
/// 返回从另一个瞬间到当前瞬间所经过的时间量，
///
/// [currently]: crate::io#platform-specific-behavior
/// [`insecure_time` usercall]: https://edp.fortanix.com/docs/api/fortanix_sgx_abi/struct.Usercalls.html#method.insecure_time
/// [timekeeping in SGX]: https://edp.fortanix.com/docs/concepts/rust-std/#codestdtimecode
/// [clock_gettime (Realtime Clock)]: https://pubs.opengroup.org/onlinepubs/9799919799/functions/clock_getres.html
/// [GetSystemTimePreciseAsFileTime]: https://docs.microsoft.com/en-us/windows/win32/api/sysinfoapi/nf-sysinfoapi-getsystemtimepreciseasfiletime
/// [GetSystemTimeAsFileTime]: https://docs.microsoft.com/en-us/windows/win32/api/sysinfoapi/nf-sysinfoapi-getsystemtimeasfiletime
///
/// 如果那个瞬间比当前瞬间晚，则返回零持续时间。
///
/// > Note: mathematical operations like [`add`] may panic if the underlying
/// > structure cannot represent the new point in time.
///
/// [`add`]: SystemTime::add
/// [`UNIX_EPOCH`]: SystemTime::UNIX_EPOCH
#[derive(Copy, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[stable(feature = "time2", since = "1.8.0")]
pub struct SystemTime(time::SystemTime);

/// An error returned from the `duration_since` and `elapsed` methods on
/// `SystemTime`, used to learn how far in the opposite direction a system time
/// # 示例
///
/// # 示例
///
/// ```no_run
/// use std::thread::sleep;
/// use std::time::{Duration, SystemTime};
///
/// let sys_time = SystemTime::now();
/// sleep(Duration::from_secs(1));
/// let new_sys_time = SystemTime::now();
/// match sys_time.duration_since(new_sys_time) {
///     Ok(_) => {}
///     Err(e) => println!("SystemTimeError difference: {:?}", e.duration()),
/// }
/// ```
#[derive(Clone, Debug)]
#[stable(feature = "time2", since = "1.8.0")]
pub struct SystemTimeError(Duration);

impl Instant {
    /// 返回与“现在”对应的瞬间。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::time::Instant;
    ///
    /// let now = Instant::now();
    /// ```
    #[must_use]
    #[stable(feature = "time2", since = "1.8.0")]
    #[cfg_attr(not(test), rustc_diagnostic_item = "instant_now")]
    pub fn now() -> Instant {
        Instant(time::Instant::now())
    }

    /// 返回从另一个瞬间到当前瞬间所经过的时间量，
    /// 如果那个瞬间比当前瞬间晚，则返回零持续时间。
    ///
    /// # panic
    ///
    /// Previous Rust versions panicked when `earlier` was later than `self`. Currently this
    /// 方法会达到饱和状态。未来的版本可能在某些情况下重新引入 panic。
    /// 参见 [单调性]。
    ///
    /// [Monotonicity]: Instant#monotonicity
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::time::{Duration, Instant};
    /// use std::thread::sleep;
    ///
    /// let now = Instant::now();
    /// sleep(Duration::new(1, 0));
    /// let new_now = Instant::now();
    /// println!("{:?}", new_now.duration_since(now));
    /// println!("{:?}", now.duration_since(new_now)); // 0ns
    /// ```
    #[must_use]
    #[stable(feature = "time2", since = "1.8.0")]
    pub fn duration_since(&self, earlier: Instant) -> Duration {
        self.checked_duration_since(earlier).unwrap_or_default()
    }

    /// 返回从另一个瞬间到当前瞬间所经过的时间量，
    /// 如果那个瞬间比当前瞬间晚，则返回 None。
    ///
    /// Due to [monotonicity bugs], even under correct logical ordering of the passed `Instant`s,
    /// this method can return `None`.
    ///
    /// [monotonicity bugs]: Instant#monotonicity
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::time::{Duration, Instant};
    /// use std::thread::sleep;
    ///
    /// let now = Instant::now();
    /// sleep(Duration::new(1, 0));
    /// let new_now = Instant::now();
    /// println!("{:?}", new_now.checked_duration_since(now));
    /// println!("{:?}", now.checked_duration_since(new_now)); // None
    /// ```
    #[must_use]
    #[stable(feature = "checked_duration_since", since = "1.39.0")]
    pub fn checked_duration_since(&self, earlier: Instant) -> Option<Duration> {
        self.0.checked_sub_instant(&earlier.0)
    }

    /// 返回从另一个瞬间到当前瞬间所经过的时间量，
    /// 如果那个瞬间比当前瞬间晚，则返回零持续时间。
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::time::{Duration, Instant};
    /// use std::thread::sleep;
    ///
    /// let now = Instant::now();
    /// sleep(Duration::new(1, 0));
    /// let new_now = Instant::now();
    /// println!("{:?}", new_now.saturating_duration_since(now));
    /// println!("{:?}", now.saturating_duration_since(new_now)); // 0ns
    /// ```
    #[must_use]
    #[stable(feature = "checked_duration_since", since = "1.39.0")]
    pub fn saturating_duration_since(&self, earlier: Instant) -> Duration {
        self.checked_duration_since(earlier).unwrap_or_default()
    }

    /// 返回自当前时刻起经过的时间长度。
    ///
    /// # 恐慌
    ///
    /// 之前的 Rust 版本在当前时间早于 `self` 时会触发恐慌。目前此
    /// 方法在那种情况下返回零的 `Duration`。未来的版本可能会重新引入恐慌。
    /// 参见 [单调性]。
    ///
    /// [Monotonicity]: Instant#monotonicity
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::thread::sleep;
    /// use std::time::{Duration, Instant};
    ///
    /// let instant = Instant::now();
    /// let three_secs = Duration::from_secs(3);
    /// sleep(three_secs);
    /// assert!(instant.elapsed() >= three_secs);
    /// ```
    #[must_use]
    #[stable(feature = "time2", since = "1.8.0")]
    pub fn elapsed(&self) -> Duration {
        Instant::now() - *self
    }

    /// Returns `Some(t)` where `t` is the time `self + duration` if `t` can be represented as
    /// `Instant` (which means it's inside the bounds of the underlying data structure), `None`
    /// 否则。
    #[stable(feature = "time_checked_add", since = "1.34.0")]
    pub fn checked_add(&self, duration: Duration) -> Option<Instant> {
        self.0.checked_add_duration(&duration).map(Instant)
    }

    /// Returns `Some(t)` where `t` is the time `self - duration` if `t` can be represented as
    /// `Instant` (which means it's inside the bounds of the underlying data structure), `None`
    /// 否则。
    #[stable(feature = "time_checked_add", since = "1.34.0")]
    pub fn checked_sub(&self, duration: Duration) -> Option<Instant> {
        self.0.checked_sub_duration(&duration).map(Instant)
    }

    // Used by platform specific `sleep_until` implementations such as the one used on Linux.
    #[cfg_attr(
        not(target_os = "linux"),
        allow(unused, reason = "not every platform has a specific `sleep_until`")
    )]
    pub(crate) fn into_inner(self) -> time::Instant {
        self.0
    }
}

#[stable(feature = "time2", since = "1.8.0")]
impl Add<Duration> for Instant {
    type Output = Instant;

    /// # 恐慌
    ///
    /// 如果结果时间点无法被底层数据结构表示，此函数可能会触发恐慌。
    /// underlying data structure. See [`Instant::checked_add`] for a version without panic.
    #[track_caller]
    fn add(self, other: Duration) -> Instant {
        self.checked_add(other).expect("overflow when adding duration to instant")
    }
}

#[stable(feature = "time_augmented_assignment", since = "1.9.0")]
impl AddAssign<Duration> for Instant {
    fn add_assign(&mut self, other: Duration) {
        *self = *self + other;
    }
}

#[stable(feature = "time2", since = "1.8.0")]
impl Sub<Duration> for Instant {
    type Output = Instant;

    #[track_caller]
    fn sub(self, other: Duration) -> Instant {
        self.checked_sub(other).expect("overflow when subtracting duration from instant")
    }
}

#[stable(feature = "time_augmented_assignment", since = "1.9.0")]
impl SubAssign<Duration> for Instant {
    fn sub_assign(&mut self, other: Duration) {
        *self = *self - other;
    }
}

#[stable(feature = "time2", since = "1.8.0")]
impl Sub<Instant> for Instant {
    type Output = Duration;

    /// 返回从另一个时刻到当前时刻所经过的时间长度，
    /// 如果该时刻晚于当前时刻，则返回零持续时间。
    ///
    /// # 恐慌
    ///
    /// Previous Rust versions panicked when `other` was later than `self`. Currently this
    /// 方法会达到饱和。未来的版本可能会在某些情况下重新引入恐慌。
    /// 参见 [单调性]。
    ///
    /// [Monotonicity]: Instant#monotonicity
    fn sub(self, other: Instant) -> Duration {
        self.duration_since(other)
    }
}

#[stable(feature = "time2", since = "1.8.0")]
impl fmt::Debug for Instant {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(f)
    }
}

impl SystemTime {
    /// An anchor in time which can be used to create new `SystemTime` instances or
    /// learn about where in time a `SystemTime` lies.
    //
    // NOTE! this documentation is duplicated, here and in std::time::UNIX_EPOCH.
    // The two copies are not quite identical, because of the difference in naming.
    ///
    /// 此常量在所有系统上被定义为“1970-01-01 00:00:00 UTC”，
    /// respect to the system clock. Using `duration_since` on an existing
    /// `SystemTime` instance can tell how far away from this point in time a
    /// measurement lies, and using `UNIX_EPOCH + duration` can be used to create a
    /// `SystemTime` instance to represent another fixed point in time.
    ///
    /// `duration_since(UNIX_EPOCH).unwrap().as_secs()` returns
    /// the number of non-leap seconds since the start of 1970 UTC.
    /// This is a POSIX `time_t` (as a `u64`),
    /// # 示例
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use std::time::SystemTime;
    ///
    /// match SystemTime::now().duration_since(SystemTime::UNIX_EPOCH) {
    ///     Ok(n) => println!("1970-01-01 00:00:00 UTC was {} seconds ago!", n.as_secs()),
    ///     Err(_) => panic!("SystemTime before UNIX EPOCH!"),
    /// }
    /// ```
    #[stable(feature = "assoc_unix_epoch", since = "1.28.0")]
    pub const UNIX_EPOCH: SystemTime = UNIX_EPOCH;

    /// Represents the maximum value representable by [`SystemTime`] on this platform.
    ///
    /// This value differs a lot between platforms, but it is always the case
    /// that any positive addition of a [`Duration`], whose value is greater
    /// # 示例
    /// [`SystemTime::MAX`] will fail.
    ///
    /// # 此值在不同平台之间差异很大，但始终成立的是
    ///
    /// ```no_run
    /// #![feature(time_systemtime_limits)]
    /// use std::time::{Duration, SystemTime};
    ///
    /// // Adding zero will change nothing.
    /// assert_eq!(SystemTime::MAX.checked_add(Duration::ZERO), Some(SystemTime::MAX));
    ///
    /// // But adding just one second will already fail ...
    /// //
    /// // Keep in mind that this in fact may succeed, if the Duration is
    /// // smaller than the time precision of the operating system, which
    /// // happens to be 1ns on most operating systems, with Windows being the
    /// // notable exception by using 100ns, hence why this example uses 1s.
    /// assert_eq!(SystemTime::MAX.checked_add(Duration::new(1, 0)), None);
    ///
    /// // Utilize this for saturating arithmetic to improve error handling.
    /// // In this case, we will use a certificate with a timestamp in the
    /// // future as a practical example.
    /// let configured_offset = Duration::from_secs(60 * 60 * 24);
    /// let valid_after =
    ///     SystemTime::now()
    ///         .checked_add(configured_offset)
    ///         .unwrap_or(SystemTime::MAX);
    /// ```
    #[unstable(feature = "time_systemtime_limits", issue = "149067")]
    pub const MAX: SystemTime = SystemTime(time::SystemTime::MAX);

    /// Represents the minimum value representable by [`SystemTime`] on this platform.
    ///
    /// This value differs a lot between platforms, but it is always the case
    /// that any positive subtraction of a [`Duration`] from, whose value is
    /// greater than or equal to the time precision of the operating system, to
    /// [`SystemTime::MIN`] will fail.
    ///
    /// Depending on the platform, this may be either less than or equal to
    /// [`SystemTime::UNIX_EPOCH`], depending on whether the operating system
    /// supports the representation of timestamps before the Unix epoch or not.
    /// However, it is always guaranteed that a [`SystemTime::UNIX_EPOCH`] fits
    /// between a [`SystemTime::MIN`] and [`SystemTime::MAX`].
    ///
    /// # Examples
    ///
    /// ```
    /// #![feature(time_systemtime_limits)]
    /// use std::time::{Duration, SystemTime};
    ///
    /// // Subtracting zero will change nothing.
    /// assert_eq!(SystemTime::MIN.checked_sub(Duration::ZERO), Some(SystemTime::MIN));
    ///
    /// // But subtracting just one second will already fail.
    /// //
    /// // Keep in mind that this in fact may succeed, if the Duration is
    /// // smaller than the time precision of the operating system, which
    /// // happens to be 1ns on most operating systems, with Windows being the
    /// // notable exception by using 100ns, hence why this example uses 1s.
    /// assert_eq!(SystemTime::MIN.checked_sub(Duration::new(1, 0)), None);
    ///
    /// // Utilize this for saturating arithmetic to improve error handling.
    /// // In this case, we will use a cache expiry as a practical example.
    /// let configured_expiry = Duration::from_secs(60 * 3);
    /// let expiry_threshold =
    ///     SystemTime::now()
    ///         .checked_sub(configured_expiry)
    ///         .unwrap_or(SystemTime::MIN);
    /// ```
    #[unstable(feature = "time_systemtime_limits", issue = "149067")]
    pub const MIN: SystemTime = SystemTime(time::SystemTime::MIN);

    /// Returns the system time corresponding to "now".
    ///
    /// # Examples
    ///
    /// ```
    /// use std::time::SystemTime;
    ///
    /// let sys_time = SystemTime::now();
    /// ```
    #[must_use]
    #[stable(feature = "time2", since = "1.8.0")]
    pub fn now() -> SystemTime {
        SystemTime(time::SystemTime::now())
    }

    /// Returns the amount of time elapsed from an earlier point in time.
    ///
    /// This function may fail because measurements taken earlier are not
    /// guaranteed to always be before later measurements (due to anomalies such
    /// as the system clock being adjusted either forwards or backwards).
    /// [`Instant`] can be used to measure elapsed time without this risk of failure.
    ///
    /// If successful, <code>[Ok]\([Duration])</code> is returned where the duration represents
    /// the amount of time elapsed from the specified measurement to this one.
    ///
    /// Returns an [`Err`] if `earlier` is later than `self`, and the error
    /// contains how far from `self` the time is.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use std::time::SystemTime;
    ///
    /// let sys_time = SystemTime::now();
    /// let new_sys_time = SystemTime::now();
    /// let difference = new_sys_time.duration_since(sys_time)
    ///     .expect("Clock may have gone backwards");
    /// println!("{difference:?}");
    /// ```
    #[stable(feature = "time2", since = "1.8.0")]
    pub fn duration_since(&self, earlier: SystemTime) -> Result<Duration, SystemTimeError> {
        self.0.sub_time(&earlier.0).map_err(SystemTimeError)
    }

    /// Returns the difference from this system time to the
    /// current clock time.
    ///
    /// This function may fail as the underlying system clock is susceptible to
    /// drift and updates (e.g., the system clock could go backwards), so this
    /// function might not always succeed. If successful, <code>[Ok]\([Duration])</code> is
    /// returned where the duration represents the amount of time elapsed from
    /// this time measurement to the current time.
    ///
    /// To measure elapsed time reliably, use [`Instant`] instead.
    ///
    /// Returns an [`Err`] if `self` is later than the current system time, and
    /// the error contains how far from the current system time `self` is.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use std::thread::sleep;
    /// use std::time::{Duration, SystemTime};
    ///
    /// let sys_time = SystemTime::now();
    /// let one_sec = Duration::from_secs(1);
    /// sleep(one_sec);
    /// assert!(sys_time.elapsed().unwrap() >= one_sec);
    /// ```
    #[stable(feature = "time2", since = "1.8.0")]
    pub fn elapsed(&self) -> Result<Duration, SystemTimeError> {
        SystemTime::now().duration_since(*self)
    }

    /// Returns `Some(t)` where `t` is the time `self + duration` if `t` can be represented as
    /// `SystemTime` (which means it's inside the bounds of the underlying data structure), `None`
    /// otherwise.
    ///
    /// In the case that the `duration` is smaller than the time precision of the operating
    /// system, `Some(self)` will be returned.
    #[stable(feature = "time_checked_add", since = "1.34.0")]
    pub fn checked_add(&self, duration: Duration) -> Option<SystemTime> {
        self.0.checked_add_duration(&duration).map(SystemTime)
    }

    /// Returns `Some(t)` where `t` is the time `self - duration` if `t` can be represented as
    /// `SystemTime` (which means it's inside the bounds of the underlying data structure), `None`
    /// 否则。
    ///
    /// In the case that the `duration` is smaller than the time precision of the operating
    /// system, `Some(self)` will be returned.
    #[stable(feature = "time_checked_add", since = "1.34.0")]
    pub fn checked_sub(&self, duration: Duration) -> Option<SystemTime> {
        self.0.checked_sub_duration(&duration).map(SystemTime)
    }

    /// Saturating [`SystemTime`] addition, computing `self + duration`,
    /// returning [`SystemTime::MAX`] if overflow occurred.
    ///
    /// In the case that the `duration` is smaller than the time precision of
    /// the operating system, `self` will be returned.
    #[unstable(feature = "time_saturating_systemtime", issue = "151199")]
    pub fn saturating_add(&self, duration: Duration) -> SystemTime {
        self.checked_add(duration).unwrap_or(SystemTime::MAX)
    }

    /// Saturating [`SystemTime`] subtraction, computing `self - duration`,
    /// returning [`SystemTime::MIN`] if overflow occurred.
    ///
    /// In the case that the `duration` is smaller than the time precision of
    /// the operating system, `self` will be returned.
    #[unstable(feature = "time_saturating_systemtime", issue = "151199")]
    pub fn saturating_sub(&self, duration: Duration) -> SystemTime {
        self.checked_sub(duration).unwrap_or(SystemTime::MIN)
    }

    /// 饱和计算从之前时间点开始经过的时间，
    /// returning [`Duration::ZERO`] in the case that `earlier` is later or
    /// equal to `self`.
    ///
    /// # 异常
    ///
    /// ```no_run
    /// #![feature(time_saturating_systemtime)]
    /// use std::time::{Duration, SystemTime};
    ///
    /// let now = SystemTime::now();
    /// let prev = now.saturating_sub(Duration::new(1, 0));
    ///
    /// // now - prev should return non-zero.
    /// assert_eq!(now.saturating_duration_since(prev), Duration::new(1, 0));
    /// assert!(now.duration_since(prev).is_ok());
    ///
    /// // prev - now should return zero (and fail with the non-saturating).
    /// assert_eq!(prev.saturating_duration_since(now), Duration::ZERO);
    /// assert!(prev.duration_since(now).is_err());
    ///
    /// // now - now should return zero (and work with the non-saturating).
    /// assert_eq!(now.saturating_duration_since(now), Duration::ZERO);
    /// assert!(now.duration_since(now).is_ok());
    /// ```
    #[unstable(feature = "time_saturating_systemtime", issue = "151199")]
    pub fn saturating_duration_since(&self, earlier: SystemTime) -> Duration {
        self.duration_since(earlier).unwrap_or(Duration::ZERO)
    }
}

#[stable(feature = "time2", since = "1.8.0")]
impl Add<Duration> for SystemTime {
    type Output = SystemTime;

    /// # Panics
    ///
    /// 如果最终时间点无法由底层数据结构表示，此函数可能会引发 panic。
    /// underlying data structure. See [`SystemTime::checked_add`] for a version without panic.
    #[track_caller]
    fn add(self, dur: Duration) -> SystemTime {
        self.checked_add(dur).expect("overflow when adding duration to `SystemTime`")
    }
}

#[stable(feature = "time_augmented_assignment", since = "1.9.0")]
impl AddAssign<Duration> for SystemTime {
    fn add_assign(&mut self, other: Duration) {
        *self = *self + other;
    }
}

#[stable(feature = "time2", since = "1.8.0")]
impl Sub<Duration> for SystemTime {
    type Output = SystemTime;

    #[track_caller]
    fn sub(self, dur: Duration) -> SystemTime {
        self.checked_sub(dur).expect("overflow when subtracting duration from `SystemTime`")
    }
}

#[stable(feature = "time_augmented_assignment", since = "1.9.0")]
impl SubAssign<Duration> for SystemTime {
    fn sub_assign(&mut self, other: Duration) {
        *self = *self - other;
    }
}

#[stable(feature = "time2", since = "1.8.0")]
impl fmt::Debug for SystemTime {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(f)
    }
}

/// An anchor in time which can be used to create new `SystemTime` instances or
/// learn about where in time a `SystemTime` lies.
//
// NOTE! this documentation is duplicated, here and in SystemTime::UNIX_EPOCH.
// The two copies are not quite identical, because of the difference in naming.
///
/// 此常量在所有系统上定义为“1970-01-01 00:00:00 UTC”，
/// respect to the system clock. Using `duration_since` on an existing
/// [`SystemTime`] instance can tell how far away from this point in time a
/// measurement lies, and using `UNIX_EPOCH + duration` can be used to create a
/// [`SystemTime`] instance to represent another fixed point in time.
///
/// `duration_since(UNIX_EPOCH).unwrap().as_secs()` returns
/// 自 1970 UTC 开始以来的非闰秒数。
/// This is a POSIX `time_t` (as a `u64`),
/// 与许多互联网协议中使用的时间表示方式相同。
///
/// # 示例
///
/// ```no_run
/// use std::time::{SystemTime, UNIX_EPOCH};
///
/// match SystemTime::now().duration_since(UNIX_EPOCH) {
///     Ok(n) => println!("1970-01-01 00:00:00 UTC was {} seconds ago!", n.as_secs()),
///     Err(_) => panic!("SystemTime before UNIX EPOCH!"),
/// }
/// ```
#[stable(feature = "time2", since = "1.8.0")]
pub const UNIX_EPOCH: SystemTime = SystemTime(time::UNIX_EPOCH);

impl SystemTimeError {
    /// 返回表示秒系统时间比第一个时间点超前多少的正持续时间。
    /// second system time was from the first.
    ///
    /// A `SystemTimeError` is returned from the [`SystemTime::duration_since`]
    /// and [`SystemTime::elapsed`] methods whenever the second system time
    /// represents a point later in time than the `self` of the method call.
    ///
    /// # 示例
    ///
    /// ```no_run
    /// use std::thread::sleep;
    /// use std::time::{Duration, SystemTime};
    ///
    /// let sys_time = SystemTime::now();
    /// sleep(Duration::from_secs(1));
    /// let new_sys_time = SystemTime::now();
    /// match sys_time.duration_since(new_sys_time) {
    ///     Ok(_) => {}
    ///     Err(e) => println!("SystemTimeError difference: {:?}", e.duration()),
    /// }
    /// ```
    #[must_use]
    #[stable(feature = "time2", since = "1.8.0")]
    pub fn duration(&self) -> Duration {
        self.0
    }
}

#[stable(feature = "time2", since = "1.8.0")]
impl Error for SystemTimeError {}

#[stable(feature = "time2", since = "1.8.0")]
impl fmt::Display for SystemTimeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "second time provided was later than self")
    }
}

impl FromInner<time::SystemTime> for SystemTime {
    fn from_inner(time: time::SystemTime) -> SystemTime {
        SystemTime(time)
    }
}

impl IntoInner<time::SystemTime> for SystemTime {
    fn into_inner(self) -> time::SystemTime {
        self.0
    }
}
