//! 集合类型。

// Note: This module is also included in the alloctests crate using #[path] to
// run the tests. See the comment there for an explanation why this is the case.

#![stable(feature = "rust1", since = "1.0.0")]

#[cfg(not(no_global_oom_handling))]
pub mod binary_heap;
#[cfg(not(no_global_oom_handling))]
mod btree;
#[cfg(not(no_global_oom_handling))]
pub mod linked_list;
pub(crate) mod retain;
#[cfg(not(no_global_oom_handling))]
pub mod vec_deque;

#[cfg(not(no_global_oom_handling))]
#[stable(feature = "rust1", since = "1.0.0")]
pub mod btree_map {
    //! 基于 B-Tree 的有序映射。
    #[stable(feature = "rust1", since = "1.0.0")]
    #[cfg(not(test))]
    pub use super::btree::map::*;
}

#[cfg(not(no_global_oom_handling))]
#[stable(feature = "rust1", since = "1.0.0")]
pub mod btree_set {
    //! 基于 B-Tree 的有序集合。
    #[stable(feature = "rust1", since = "1.0.0")]
    #[cfg(not(test))]
    pub use super::btree::set::*;
}

#[cfg(not(test))]
use core::fmt::Display;

#[cfg(not(no_global_oom_handling))]
#[stable(feature = "rust1", since = "1.0.0")]
#[doc(no_inline)]
#[cfg(not(test))]
pub use binary_heap::BinaryHeap;
#[cfg(not(no_global_oom_handling))]
#[stable(feature = "rust1", since = "1.0.0")]
#[doc(no_inline)]
#[cfg(not(test))]
pub use btree_map::BTreeMap;
#[cfg(not(no_global_oom_handling))]
#[stable(feature = "rust1", since = "1.0.0")]
#[doc(no_inline)]
#[cfg(not(test))]
pub use btree_set::BTreeSet;
#[cfg(not(no_global_oom_handling))]
#[stable(feature = "rust1", since = "1.0.0")]
#[doc(no_inline)]
#[cfg(not(test))]
pub use linked_list::LinkedList;
#[cfg(not(no_global_oom_handling))]
#[stable(feature = "rust1", since = "1.0.0")]
#[doc(no_inline)]
#[cfg(not(test))]
pub use vec_deque::VecDeque;

#[cfg(not(test))]
use crate::alloc::{Layout, LayoutError};

/// The error type for `try_reserve` methods.
#[derive(Clone, PartialEq, Eq, Debug)]
#[stable(feature = "try_reserve", since = "1.57.0")]
#[cfg(not(test))]
pub struct TryReserveError {
    kind: TryReserveErrorKind,
}

#[cfg(test)]
pub use realalloc::collections::TryReserveError;

#[cfg(not(test))]
impl TryReserveError {
    /// 导致错误的分配详情。
    #[inline]
    #[must_use]
    #[unstable(
        feature = "try_reserve_kind",
        reason = "Uncertain how much info should be exposed",
        issue = "48043"
    )]
    #[rustc_const_unstable(feature = "const_heap", issue = "79597")]
    pub const fn kind(&self) -> TryReserveErrorKind {
        self.kind.clone()
    }
}

/// Details of the allocation that caused a `TryReserveError`
#[derive(PartialEq, Eq, Debug)]
#[unstable(
    feature = "try_reserve_kind",
    reason = "Uncertain how much info should be exposed",
    issue = "48043"
)]
#[cfg(not(test))]
pub enum TryReserveErrorKind {
    /// 由于计算出的容量超过集合最大容量而产生的错误。
    /// (usually `isize::MAX` bytes).
    CapacityOverflow,

    /// 内存分配器返回了错误。
    AllocError {
        /// 失败的内存分配请求布局。
        layout: Layout,

        #[doc(hidden)]
        #[unstable(
            feature = "container_error_extra",
            issue = "none",
            reason = "\
            Enable exposing the allocator’s custom error value \
            if an associated type is added in the future: \
            https://github.com/rust-lang/wg-allocators/issues/23"
        )]
        non_exhaustive: (),
    },
}

#[unstable(
    feature = "try_reserve_kind",
    reason = "Uncertain how much info should be exposed",
    issue = "48043"
)]
#[rustc_const_unstable(feature = "const_heap", issue = "79597")]
#[cfg(not(test))]
const impl Clone for TryReserveErrorKind {
    fn clone(&self) -> Self {
        match self {
            TryReserveErrorKind::CapacityOverflow => TryReserveErrorKind::CapacityOverflow,
            TryReserveErrorKind::AllocError { layout, non_exhaustive: () } => {
                TryReserveErrorKind::AllocError { layout: *layout, non_exhaustive: () }
            }
        }
    }
}

#[cfg(test)]
pub use realalloc::collections::TryReserveErrorKind;

#[unstable(
    feature = "try_reserve_kind",
    reason = "Uncertain how much info should be exposed",
    issue = "48043"
)]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
#[cfg(not(test))]
const impl From<TryReserveErrorKind> for TryReserveError {
    #[inline]
    fn from(kind: TryReserveErrorKind) -> Self {
        Self { kind }
    }
}

#[unstable(feature = "try_reserve_kind", issue = "48043")]
#[rustc_const_unstable(feature = "const_convert", issue = "143773")]
#[cfg(not(test))]
const impl From<LayoutError> for TryReserveErrorKind {
    /// Always evaluates to [`TryReserveErrorKind::CapacityOverflow`].
    #[inline]
    fn from(_: LayoutError) -> Self {
        TryReserveErrorKind::CapacityOverflow
    }
}

#[stable(feature = "try_reserve", since = "1.57.0")]
#[cfg(not(test))]
impl Display for TryReserveError {
    fn fmt(
        &self,
        fmt: &mut core::fmt::Formatter<'_>,
    ) -> core::result::Result<(), core::fmt::Error> {
        fmt.write_str("memory allocation failed")?;
        let reason = match self.kind {
            TryReserveErrorKind::CapacityOverflow => {
                " because the computed capacity exceeded the collection's maximum"
            }
            TryReserveErrorKind::AllocError { .. } => {
                " because the memory allocator returned an error"
            }
        };
        fmt.write_str(reason)
    }
}

/// An intermediate trait for specialization of `Extend`.
#[doc(hidden)]
#[cfg(not(no_global_oom_handling))]
trait SpecExtend<I: IntoIterator> {
    /// Extends `self` with the contents of the given iterator.
    fn spec_extend(&mut self, iter: I);
}

#[stable(feature = "try_reserve", since = "1.57.0")]
#[cfg(not(test))]
impl core::error::Error for TryReserveError {}
