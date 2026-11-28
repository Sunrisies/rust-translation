use super::join_handle::JoinHandle;
use super::lifecycle::spawn_unchecked;
use crate::io;

/// 线程工厂，可用于配置
/// 新线程的属性。
///
/// 可以通过链式调用方法来配置它。
///
/// 可用的两种配置方式如下：
///
/// - [`name`]: specifies an [associated name for the thread][naming-threads]
/// - [`stack_size`]: specifies the [desired stack size for the thread][stack-size]
///
/// The [`spawn`] method will take ownership of the builder and create an
/// [`io::Result`] to the thread handle with the given configuration.
///
/// The [`thread::spawn`] free function uses a `Builder` with default
/// configuration and [`unwrap`]s its return value.
///
/// You may want to use [`spawn`] instead of [`thread::spawn`], when you want
/// to recover from a failure to launch a thread, indeed the free function will
/// panic where the `Builder` method will return a [`io::Result`].
///
/// # 即将创建的线程的名称，用于 panic 消息中的标识。
///
/// ```
/// use std::thread;
///
/// let builder = thread::Builder::new();
///
/// let handler = builder.spawn(|| {
///     // thread code
/// }).unwrap();
///
/// handler.join().unwrap();
/// ```
///
/// [`stack_size`]: Builder::stack_size
/// [`name`]: Builder::name
/// [`spawn`]: Builder::spawn
/// [`thread::spawn`]: super::spawn
/// [`unwrap`]: crate::result::Result::unwrap
/// [naming-threads]: ./index.html#naming-threads
/// [stack-size]: ./index.html#stack-size
#[must_use = "must eventually spawn the thread"]
#[stable(feature = "rust1", since = "1.0.0")]
#[derive(Debug)]
pub struct Builder {
    /// 生成线程的栈大小，以字节为单位。
    pub(super) name: Option<String>,
    /// 子线程的栈大小，以字节为单位。
    pub(super) stack_size: Option<usize>,
    /// 跳过运行并继承线程启动钩子。
    pub(super) no_hooks: bool,
}

impl Builder {
    /// 生成创建线程的基本配置，从中可以链式调用配置方法。
    /// # 示例
    ///
    /// # 为即将创建的线程命名。目前该名称仅用于 panic 消息中的标识。
    ///
    /// ```
    /// use std::thread;
    ///
    /// let builder = thread::Builder::new()
    ///                               .name("foo".into())
    ///                               .stack_size(32 * 1024);
    ///
    /// let handler = builder.spawn(|| {
    ///     // thread code
    /// }).unwrap();
    ///
    /// handler.join().unwrap();
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn new() -> Builder {
        Builder { name: None, stack_size: None, no_hooks: false }
    }

    /// Names the thread-to-be. Currently the name is used for identification
    /// # 示例
    ///
    /// The name must not contain null bytes (`\0`).
    ///
    /// 有关命名线程的更多信息，请参阅
    /// [命名线程] 模块级文档。
    ///
    /// # 示例
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
    pub fn name(mut self, name: String) -> Builder {
        self.name = Some(name);
        self
    }

    /// 设置新线程的栈大小（以字节为单位）。
    ///
    /// 如果平台指定了最小栈大小，实际栈大小可能大于此值。
    /// # 示例
    ///
    /// 有关线程栈大小的更多信息，请参阅
    /// [栈大小] 模块级文档。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::thread;
    ///
    /// let builder = thread::Builder::new().stack_size(32 * 1024);
    /// ```
    ///
    /// [stack-size]: ./index.html#stack-size
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn stack_size(mut self, size: usize) -> Builder {
        self.stack_size = Some(size);
        self
    }

    /// 禁用运行和继承 [启动钩子]。
    ///
    /// 当父线程与子线程无关时，请使用此选项。
    /// 例如，在线程池中延迟创建线程时。
    ///
    /// [spawn hooks]: super::add_spawn_hook
    #[unstable(feature = "thread_spawn_hook", issue = "132951")]
    pub fn no_hooks(mut self) -> Builder {
        self.no_hooks = true;
        self
    }

    /// Spawns a new thread by taking ownership of the `Builder`, and returns an
    /// [`io::Result`] to its [`JoinHandle`].
    ///
    /// 创建的线程可能比调用者存活更久（除非调用者线程是主线程；当主
    /// 线程结束时，整个进程终止）。join 句柄可用于等待
    /// 创建的线程终止，包括恢复其 panic。
    /// termination of the spawned thread, including recovering its panics.
    ///
    /// For a more complete documentation see [`thread::spawn`].
    ///
    /// # Errors
    ///
    /// Unlike the [`spawn`] free function, this method yields an
    /// [`io::Result`] to capture any failure to create the thread at
    /// OS 层面。
    ///
    /// # 异常
    ///
    /// 如果设置了线程名称且其中包含空字节，则会发生异常。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::thread;
    ///
    /// let builder = thread::Builder::new();
    ///
    /// let handler = builder.spawn(|| {
    ///     // thread code
    /// }).unwrap();
    ///
    /// handler.join().unwrap();
    /// ```
    ///
    /// [`thread::spawn`]: super::spawn
    /// [`spawn`]: super::spawn
    #[stable(feature = "rust1", since = "1.0.0")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    pub fn spawn<F, T>(self, f: F) -> io::Result<JoinHandle<T>>
    where
        F: FnOnce() -> T,
        F: Send + 'static,
        T: Send + 'static,
    {
        unsafe { self.spawn_unchecked(f) }
    }

    /// Spawns a new thread without any lifetime restrictions by taking ownership
    /// of the `Builder`, and returns an [`io::Result`] to its [`JoinHandle`].
    ///
    /// The spawned thread may outlive the caller (unless the caller thread
    /// 除了生命周期边界较宽松，这使得它变得不安全。
    /// thread finishes). The join handle can be used to block on
    /// # 错误
    ///
    /// This method is identical to [`thread::Builder::spawn`][`Builder::spawn`],
    /// except for the relaxed lifetime bounds, which render it unsafe.
    /// For a more complete documentation see [`thread::spawn`].
    ///
    /// # 如果设置了线程名称且其中包含空字节，则会发生异常。
    ///
    /// Unlike the [`spawn`] free function, this method yields an
    /// [`io::Result`] to capture any failure to create the thread at
    /// OS 层面。
    ///
    /// # 异常
    ///
    /// 如果设置了线程名称且其中包含空字节，则会发生异常。
    ///
    /// # 安全性
    ///
    /// 调用者必须确保生成线程不会超出提供的线程闭包及其返回类型中的任何
    /// 引用寿命。
    /// 这可以通过两种方式保证：
    ///
    /// - ensure that [`join`][`JoinHandle::join`] is called before any referenced
    /// data is dropped
    /// - use only types with `'static` lifetime bounds, i.e., those with no or only
    /// `'static` references (both [`thread::Builder::spawn`][`Builder::spawn`]
    /// and [`thread::spawn`] enforce this property statically)
    ///
    /// # Examples
    ///
    /// ```
    /// use std::thread;
    ///
    /// let builder = thread::Builder::new();
    ///
    /// let x = 1;
    /// let thread_x = &x;
    ///
    /// let handler = unsafe {
    ///     builder.spawn_unchecked(move || {
    ///         println!("x = {}", *thread_x);
    ///     }).unwrap()
    /// };
    ///
    /// // caller has to ensure `join()` is called, otherwise
    /// // it is possible to access freed memory if `x` gets
    /// // dropped before the thread closure is executed!
    /// handler.join().unwrap();
    /// ```
    ///
    /// [`thread::spawn`]: super::spawn
    /// [`spawn`]: super::spawn
    #[stable(feature = "thread_spawn_unchecked", since = "1.82.0")]
    #[cfg_attr(miri, track_caller)] // even without panics, this helps for Miri backtraces
    pub unsafe fn spawn_unchecked<F, T>(self, f: F) -> io::Result<JoinHandle<T>>
    where
        F: FnOnce() -> T,
        F: Send,
        T: Send,
    {
        let Builder { name, stack_size, no_hooks } = self;
        Ok(JoinHandle(unsafe { spawn_unchecked(name, stack_size, no_hooks, None, f) }?))
    }
}
