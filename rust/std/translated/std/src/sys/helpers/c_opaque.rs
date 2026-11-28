use crate::mem::MaybeUninit;
use crate::pin::{Pin, UnsafePinned};

/// 一个用于封装不透明 C 对象的包装器。
///
/// 一些库，如 UNIX 的 pthread，具有必须被
/// 完全视为不透明的数据类型。由于这些类型非常难以
/// Rust 的操作语义在数据类型和指针别名等方面更为严格，例如，
/// initialization state of data types and pointer aliasing. For instance, a
/// function like `pthread_mutexattr_init` might not fully initialize the
/// `libc::pthread_mutexattr_t` passed to it, so doing e.g.
/// ```ignore (for-illustration-purposes-only)
/// let mut attr = MaybeUninit::uninit();
/// pthread_mutexattr_init(attr.as_mut_ptr());
/// let attr = attr.assume_init();
/// ```
/// is unsound. Another example: on platforms like macOS a `pthread_mutex_t`
/// 对齐方式高于定义要求。此外，
/// fields to a higher alignment than required by the definition. And furthermore,
/// some implementations (e.g. AIX) of `pthread_cond_t` use intrinsically linked
/// lists, and hence doing
/// ```ignore (for-illustration-purposes-only)
/// pub struct Condvar(UnsafeCell<libc::pthread_cont_t>);
///
/// /* initialization and usage omitted for brevity */
///
/// impl Drop for Condvar {
///     fn drop(&mut self) {
///         unsafe { libc::pthread_cond_destroy(self.0.get()) };
///     }
/// }
/// ```
/// results in undefined behaviour (even when utilizing `Pin` to ensure
/// immovability) because the creation of the `&mut Condvar` passed to `drop`
/// invalidates other pointers in the linked list.
///
/// `COpaque` helps with avoiding all these caveats:
/// * it wraps the inner value in `MaybeUninit` and thus is entirely oblivious
///   of its initialization state.
/// * [`COpaque::get`] takes a `Pin` and thus prevents accidental moves.
/// * it utilizes `UnsafePinned` to relax the aliasing guarantees of mutable
///   references to the `COpaque`.
///
/// The only way to access the inner value is via [`COpaque::get`]. It returns
/// 实际上，这个包装器的固定实例类似于 C 变量。
///
/// In effect, a pinned instance of this wrapper acts very much like a C variable.
pub struct COpaque<T> {
    inner: UnsafePinned<MaybeUninit<T>>,
}

impl<T> COpaque<T> {
    /// Creates an uninitialized C-like storage for `T`.
    ///
    /// 相应的 Rust 代码是
    /// ```c
    /// T var;
    /// ```
    /// in C, the equivalent Rust code is
    /// ```ignore (for-illustration-purposes-only)
    /// let var = pin!(COpaque::uninit());
    /// ```
    pub fn uninit() -> COpaque<T> {
        COpaque { inner: UnsafePinned::new(MaybeUninit::uninit()) }
    }

    /// Creates a zero-initialized C-like storage for `T`.
    ///
    /// 如果你在 C 中写
    /// ```c
    /// T var = {};
    /// ```
    /// 相应的 Rust 代码是
    /// ```ignore (for-illustration-purposes-only)
    /// let var = pin!(COpaque::zeroed());
    /// ```
    pub fn zeroed() -> COpaque<T> {
        COpaque { inner: UnsafePinned::new(MaybeUninit::zeroed()) }
    }

    /// Creates a pre-initialized C-like storage for `T`.
    ///
    /// 如果你在 C 中写
    /// ```c
    /// T var = T_INITIALIZER;
    /// ```
    /// 相应的 Rust 代码是
    /// ```ignore (for-illustration-purposes-only)
    /// let var = pin!(COpaque::new(T_INITIALIZER));
    /// ```
    pub fn new(initializer: T) -> COpaque<T> {
        COpaque { inner: UnsafePinned::new(MaybeUninit::new(initializer)) }
    }

    /// 获取指向值的指针。
    ///
    /// 将其用作 C 中的 & 运算符的替代方案。
    pub fn get(self: Pin<&Self>) -> *mut T {
        self.inner.get().cast_init()
    }
}
