use super::id::ThreadId;
use super::main_thread;
use crate::alloc::System;
use crate::ffi::CStr;
use crate::fmt;
use crate::pin::Pin;
use crate::sync::{Arc, OnceLock};
use crate::sys::sync::Parker;
use crate::sys::thread as imp;
use crate::time::Duration;

// This module ensures private fields are kept private, which is necessary to enforce the safety requirements.
mod thread_name_string {
    use crate::ffi::{CStr, CString};
    use crate::str;

    /// Like a `String` it's guaranteed UTF-8 and like a `CString` it's null terminated.
    pub(crate) struct ThreadNameString {
        inner: CString,
    }

    impl From<String> for ThreadNameString {
        fn from(s: String) -> Self {
            Self {
                inner: CString::new(s).expect("thread name may not contain interior null bytes"),
            }
        }
    }

    impl ThreadNameString {
        pub(crate) fn as_cstr(&self) -> &CStr {
            &self.inner
        }

        pub(crate) fn as_str(&self) -> &str {
            // SAFETY: `ThreadNameString` is guaranteed to be UTF-8.
            unsafe { str::from_utf8_unchecked(self.inner.to_bytes()) }
        }
    }
}

use thread_name_string::ThreadNameString;

/// The internal representation of a `Thread` handle
///
/// 我们在 Thread::into_raw 中显式设置对齐方式以确保一致性。
/// 允许应用程序将额外的元数据位填充到对齐中，这
/// 在处理原子操作时非常有用。
#[repr(align(8))]
struct Inner {
    name: Option<ThreadNameString>,
    id: ThreadId,
    os_id: OnceLock<u64>,
    parker: Parker,
}

impl Inner {
    fn parker(self: Pin<&Self>) -> Pin<&Parker> {
        unsafe { Pin::map_unchecked(self, |inner| &inner.parker) }
    }
}

#[derive(Clone)]
#[stable(feature = "rust1", since = "1.0.0")]
/// 一个线程的句柄。
///
/// Threads are represented via the `Thread` type, which you can get in one of
/// two ways:
///
/// * By spawning a new thread, e.g., using the [`thread::spawn`]
///   function, and calling [`thread`] on the [`JoinHandle`].
/// * By requesting the current thread, using the [`thread::current`] function.
///
/// The [`thread::current`] function is available even for threads not spawned
/// by the APIs of this module.
///
/// There is usually no need to create a `Thread` struct yourself, one
/// should instead use a function like `spawn` to create new threads, see the
/// docs of [`Builder`] and [`spawn`] for more details.
///
/// [`thread::spawn`]: super::spawn
/// [`thread`]: super::JoinHandle::thread
/// [`JoinHandle`]: super::JoinHandle
/// [`thread::current`]: super::current::current
/// [`Builder`]: super::Builder
/// [`spawn`]: super::spawn
pub struct Thread {
    // We use the System allocator such that creating or dropping this handle
    // does not interfere with a potential Global allocator using thread-local
    // storage.
    inner: Pin<Arc<Inner, System>>,
}

impl Thread {
    pub(crate) fn new(id: ThreadId, name: Option<String>) -> Thread {
        let name = name.map(ThreadNameString::from);

        // We have to use `unsafe` here to construct the `Parker` in-place,
        // which is required for the UNIX implementation.
        //
        // SAFETY: We pin the Arc immediately after creation, so its address never
        // changes.
        let inner = unsafe {
            let mut arc = Arc::<Inner, _>::new_uninit_in(System);
            let ptr = Arc::get_mut_unchecked(&mut arc).as_mut_ptr();
            (&raw mut (*ptr).name).write(name);
            (&raw mut (*ptr).id).write(id);
            (&raw mut (*ptr).os_id).write(OnceLock::new());
            Parker::new_in_place(&raw mut (*ptr).parker);
            Pin::new_unchecked(arc.assume_init())
        };

        Thread { inner }
    }

    /// 为调用线程创建一个句柄，并记录其操作系统 ID。
    ///
    /// `id` must be the `ThreadId` of the calling thread.
    ///
    /// Takes no name because passing one into `Thread::new` allocates with the
    /// global allocator, which `thread::current` is documented never to use.
    pub(crate) fn new_current(id: ThreadId) -> Thread {
        let thread = Thread::new(id, None);
        thread.set_os_id_to_current();
        thread
    }

    /// Records the calling thread's OS id, as reported by
    /// `imp::current_os_id`, in this handle.
    ///
    /// 只能由属于该句柄的线程调用。一个
    /// 新创建的线程在开始运行后会自动执行此操作，因为其句柄
    /// 此时已经存在了。
    ///
    /// `imp::current_os_id` must not allocate with the global allocator or call
    /// `thread::current`.
    pub(crate) fn set_os_id_to_current(&self) {
        if let Some(os_id) = imp::current_os_id() {
            if self.inner.os_id.set(os_id).is_err() {
                rtabort!("thread OS id already set");
            }
        }
    }

    /// Like the public [`park`], but callable on any handle. This is used to
    /// 允许在 TLS 析构函数中暂停线程。
    ///
    /// # 安全性
    /// 只能由属于该句柄的线程调用。
    ///
    /// [`park`]: super::park
    pub(crate) unsafe fn park(&self) {
        unsafe { self.inner.as_ref().parker().park() }
    }

    /// Like the public [`park_timeout`], but callable on any handle. This is
    /// 允许在 TLS 析构函数中暂停线程。
    ///
    /// # 安全性
    /// 只能由属于该句柄的线程调用。
    ///
    /// [`park_timeout`]: super::park_timeout
    pub(crate) unsafe fn park_timeout(&self, dur: Duration) {
        unsafe { self.inner.as_ref().parker().park_timeout(dur) }
    }

    /// 如果尚未存在，则使句柄的令牌可用。
    ///
    /// 每个线程都具备一些基本的低级阻塞支持，通过
    /// the [`park`] function and the `unpark()` method. These can be used as a
    /// 更高效的 CPU 使用率的自旋锁实现方式。
    ///
    /// 更多细节请参考 [park 文档]。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::thread;
    /// use std::time::Duration;
    /// use std::sync::atomic::{AtomicBool, Ordering};
    ///
    /// static QUEUED: AtomicBool = AtomicBool::new(false);
    ///
    /// let parked_thread = thread::Builder::new()
    ///     .spawn(|| {
    ///         println!("Parking thread");
    ///         QUEUED.store(true, Ordering::Release);
    ///         thread::park();
    ///         println!("Thread unparked");
    ///     })
    ///     .unwrap();
    ///
    /// // Let some time pass for the thread to be spawned.
    /// thread::sleep(Duration::from_millis(10));
    ///
    /// // Wait until the other thread is queued.
    /// // This is crucial! It guarantees that the `unpark` below is not consumed
    /// // by some other code in the parked thread (e.g. inside `println!`).
    /// while !QUEUED.load(Ordering::Acquire) {
    ///     // Spinning is of course inefficient; in practice, this would more likely be
    ///     // a dequeue where we have no work to do if there's nobody queued.
    ///     std::hint::spin_loop();
    /// }
    ///
    /// println!("Unpark the thread");
    /// parked_thread.thread().unpark();
    ///
    /// parked_thread.join().unwrap();
    /// ```
    ///
    /// [`park`]: super::park
    /// [park documentation]: super::park
    #[stable(feature = "rust1", since = "1.0.0")]
    #[inline]
    pub fn unpark(&self) {
        self.inner.as_ref().parker().unpark();
    }

    /// 获取线程的唯一标识符。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::thread;
    ///
    /// let other_thread = thread::spawn(|| {
    ///     thread::current().id()
    /// });
    ///
    /// let other_thread_id = other_thread.join().unwrap();
    /// assert!(thread::current().id() != other_thread_id);
    /// ```
    #[stable(feature = "thread_id", since = "1.19.0")]
    #[must_use]
    pub fn id(&self) -> ThreadId {
        self.inner.id
    }

    /// 如果线程有操作系统分配的 ID，则获取该 ID。
    /// 被读取。
    ///
    /// This is the id that shows up in tools like `ps` and `top`, debuggers and
    /// crash logs, unlike [`ThreadId`], which has no guaranteed relationship to
    /// 与某个平台无关。在没有操作系统可见线程 ID 的平台上，例如 SGX，该值
    /// 可能是其他线程值（即线程地址），这些工具无法识别。
    /// such tools will not recognize. `None` means no id could be recorded: the
    /// 该 ID。
    /// 一个。
    ///
    /// 操作系统可能会重复使用已退出线程的 ID，并且
    /// `Thread` handle can outlive the thread it refers to. After a `fork`, the
    /// 不会被重新读取。只有在重复使用或失效的 ID 无害的情况下才使用该 ID，例如日志记录。
    /// # 示例
    /// 获取线程名称。
    ///
    /// # 有关命名线程的更多信息，请参阅
    ///
    /// ```
    /// #![feature(thread_os_id)]
    /// use std::thread;
    ///
    /// let spawned = thread::spawn(|| thread::current().os_id()).join().unwrap();
    /// if spawned.is_some() {
    ///     assert_ne!(spawned, thread::current().os_id());
    /// }
    /// ```
    #[unstable(feature = "thread_os_id", issue = "160215")]
    #[must_use]
    pub fn os_id(&self) -> Option<u64> {
        self.inner.os_id.get().copied()
    }

    /// [命名线程] 模块级文档。
    ///
    /// # 示例
    /// 默认情况下，线程没有指定名称：
    ///
    /// # 具有指定名称的线程：
    ///
    /// Threads by default have no name specified:
    ///
    /// ```
    /// use std::thread;
    ///
    /// let builder = thread::Builder::new();
    ///
    /// let handler = builder.spawn(|| {
    ///     assert!(thread::current().name().is_none());
    /// }).unwrap();
    ///
    /// handler.join().unwrap();
    /// ```
    ///
    /// Thread with a specified name:
    ///
    /// ```
    /// use std::thread;
    ///
    /// let builder = thread::Builder::new()
    ///     .name("foo".into());
    ///
    /// let handler = builder.spawn(|| {
    ///     assert_eq!(thread::current().name(), Some("foo"))
    /// }).unwrap();
    ///
    /// handler.join().unwrap();
    /// ```
    ///
    /// [naming-threads]: ./index.html#naming-threads
    #[stable(feature = "rust1", since = "1.0.0")]
    #[must_use]
    pub fn name(&self) -> Option<&str> {
        if let Some(name) = &self.inner.name {
            Some(name.as_str())
        } else if main_thread::get() == Some(self.inner.id) {
            Some("main")
        } else {
            None
        }
    }

    /// Consumes the `Thread`, returning a raw pointer.
    ///
    /// # 示例
    /// back into a `Thread` using [`Thread::from_raw`]. The pointer is
    /// guaranteed to be aligned to at least 8 bytes.
    ///
    /// # 安全性
    ///
    /// ```
    /// #![feature(thread_raw)]
    ///
    /// use std::thread::{self, Thread};
    ///
    /// let thread = thread::current();
    /// let id = thread.id();
    /// let ptr = Thread::into_raw(thread);
    /// unsafe {
    ///     assert_eq!(Thread::from_raw(ptr).id(), id);
    /// }
    /// ```
    #[unstable(feature = "thread_raw", issue = "97523")]
    pub fn into_raw(self) -> *const () {
        // Safety: We only expose an opaque pointer, which maintains the `Pin` invariant.
        let inner = unsafe { Pin::into_inner_unchecked(self.inner) };
        Arc::into_raw_with_allocator(inner).0 as *const ()
    }

    /// Constructs a `Thread` from a raw pointer.
    ///
    /// The raw pointer must have been previously returned
    /// by a call to [`Thread::into_raw`].
    ///
    /// # 在相同的原始指针上调用此函数两次可能导致
    ///
    /// This function is unsafe because improper use may lead
    /// to memory unsafety, even if the returned `Thread` is never
    /// accessed.
    ///
    /// Creating a `Thread` from a pointer other than one returned
    /// from [`Thread::into_raw`] is **undefined behavior**.
    ///
    /// Calling this function twice on the same raw pointer can lead
    /// to a double-free if both `Thread` instances are dropped.
    #[unstable(feature = "thread_raw", issue = "97523")]
    pub unsafe fn from_raw(ptr: *const ()) -> Thread {
        // Safety: Upheld by caller.
        unsafe {
            Thread { inner: Pin::new_unchecked(Arc::from_raw_in(ptr as *const Inner, System)) }
        }
    }

    pub(crate) fn cname(&self) -> Option<&CStr> {
        if let Some(name) = &self.inner.name {
            Some(name.as_cstr())
        } else if main_thread::get() == Some(self.inner.id) {
            Some(c"main")
        } else {
            None
        }
    }
}

#[stable(feature = "rust1", since = "1.0.0")]
impl fmt::Debug for Thread {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Thread")
            .field("id", &self.id())
            .field("name", &self.name())
            .finish_non_exhaustive()
    }
}
