#![stable(feature = "rust1", since = "1.0.0")]

//! 线程安全的引用计数指针。
//!
//! See the [`Arc<T>`][Arc] documentation for more details.
//!
//! **注意**：此模块仅适用于支持原子操作的平台。
//! 对指针的加载和存储操作。这可以在编译时被检测出来。
//! `#[cfg(target_has_atomic = "ptr")]`.

#[unstable(feature = "unique_rc_arc", issue = "112566")]
pub use crate::rcs::arc::UniqueArc;
#[stable(feature = "rust1", since = "1.0.0")]
pub use crate::rcs::arc::{Arc, Weak};
