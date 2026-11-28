//! A `LazyKey` implementation using racy initialization.
//!
//! Unfortunately, none of the platforms currently supported by `std` allows
//! 在编译时生成 TLS 密钥。因此我们需要一种延迟创建密钥的方法。
//! Instead of blocking API like `OnceLock`, we use racy initialization, which
//! 应该更加轻量，并且避免了与其它部分的循环依赖。
//! `std`.

use crate::sync::atomic::{Atomic, AtomicUsize, Ordering};

/// 一种用于静态分配的 TLS 密钥的类型。
///
/// This is basically a `LazyLock<Key>`, but avoids blocking and circular
/// dependencies with the rest of `std`.
pub struct LazyKey {
    /// 内部静态 TLS 密钥（内部细节）。
    key: Atomic<usize>,
    /// TLS 值的析构函数。
    dtor: Option<unsafe extern "C" fn(*mut u8)>,
}

// Define a sentinel value that is likely not to be returned
// as a TLS key.
#[cfg(not(any(target_os = "nto", target_os = "qnx")))]
const KEY_SENTVAL: usize = 0;
// On QNX SDP, 0 is always returned when currently not in use.
// Using 0 would mean to always create two keys and remove the first
// one (with value of 0) immediately afterwards.
#[cfg(any(target_os = "nto", target_os = "qnx"))]
const KEY_SENTVAL: usize = libc::PTHREAD_KEYS_MAX + 1;

impl LazyKey {
    pub const fn new(dtor: Option<unsafe extern "C" fn(*mut u8)>) -> LazyKey {
        LazyKey { key: AtomicUsize::new(KEY_SENTVAL), dtor }
    }

    #[inline]
    pub fn force(&self) -> super::Key {
        match self.key.load(Ordering::Acquire) {
            KEY_SENTVAL => self.lazy_init() as super::Key,
            n => n as super::Key,
        }
    }

    #[cold]
    fn lazy_init(&self) -> usize {
        // POSIX allows the key created here to be KEY_SENTVAL, but the compare_exchange
        // below relies on using KEY_SENTVAL as a sentinel value to check who won the
        // race to set the shared TLS key. As far as I know, there is no
        // guaranteed value that cannot be returned as a posix_key_create key,
        // so there is no value we can initialize the inner key with to
        // prove that it has not yet been set. As such, we'll continue using a
        // value of KEY_SENTVAL, but with some gyrations to make sure we have a non-KEY_SENTVAL
        // value returned from the creation routine.
        // FIXME: this is clearly a hack, and should be cleaned up.
        let key1 = super::create(self.dtor);
        let key = if key1 as usize != KEY_SENTVAL {
            key1
        } else {
            let key2 = super::create(self.dtor);
            unsafe {
                super::destroy(key1);
            }
            key2
        };
        rtassert!(key as usize != KEY_SENTVAL);
        match self.key.compare_exchange(
            KEY_SENTVAL,
            key as usize,
            Ordering::Release,
            Ordering::Acquire,
        ) {
            // The CAS succeeded, so we've created the actual key
            Ok(_) => key as usize,
            // If someone beat us to the punch, use their key instead
            Err(n) => unsafe {
                super::destroy(key);
                n
            },
        }
    }
}
