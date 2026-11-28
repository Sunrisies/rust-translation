//! 不会产生毒化的同步锁。
//!
//! The difference from the locks in the [`poison`] module is that the locks in this module will not
//! 产生中毒现象。
//!
//! [`poison`]: super::poison

use crate::fmt;

/// 非阻塞锁定方法结果的类型别名。
#[unstable(feature = "sync_nonpoison", issue = "134645")]
pub type TryLockResult<Guard> = Result<Guard, WouldBlock>;

/// 由于操作否则会阻塞，因此当前无法获取锁。
#[unstable(feature = "sync_nonpoison", issue = "134645")]
pub struct WouldBlock;

#[unstable(feature = "sync_nonpoison", issue = "134645")]
impl fmt::Debug for WouldBlock {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        "WouldBlock".fmt(f)
    }
}

#[unstable(feature = "sync_nonpoison", issue = "134645")]
impl fmt::Display for WouldBlock {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        "try_lock failed because the operation would block".fmt(f)
    }
}

#[unstable(feature = "nonpoison_condvar", issue = "134645")]
pub use self::condvar::Condvar;
#[unstable(feature = "mapped_lock_guards", issue = "117108")]
pub use self::mutex::MappedMutexGuard;
#[unstable(feature = "nonpoison_mutex", issue = "134645")]
pub use self::mutex::{Mutex, MutexGuard};
#[unstable(feature = "mapped_lock_guards", issue = "117108")]
pub use self::rwlock::{MappedRwLockReadGuard, MappedRwLockWriteGuard};
#[unstable(feature = "nonpoison_rwlock", issue = "134645")]
pub use self::rwlock::{RwLock, RwLockReadGuard, RwLockWriteGuard};

mod condvar;
mod mutex;
mod rwlock;
