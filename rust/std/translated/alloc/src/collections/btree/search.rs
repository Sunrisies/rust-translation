use core::borrow::Borrow;
use core::cmp::Ordering;
use core::ops::{Bound, RangeBounds};

use SearchBound::*;
use SearchResult::*;

use super::node::ForceResult::*;
use super::node::{Handle, NodeRef, marker};

pub(super) enum SearchBound<T> {
    /// An inclusive bound to look for, just like `Bound::Included(T)`.
    Included(T),
    /// An exclusive bound to look for, just like `Bound::Excluded(T)`.
    Excluded(T),
    /// An unconditional inclusive bound, just like `Bound::Unbounded`.
    AllIncluded,
    /// 一个无条件排除性边界。
    AllExcluded,
}

impl<T> SearchBound<T> {
    pub(super) fn from_range(range_bound: Bound<T>) -> Self {
        match range_bound {
            Bound::Included(t) => Included(t),
            Bound::Excluded(t) => Excluded(t),
            Bound::Unbounded => AllIncluded,
        }
    }
}

pub(super) enum SearchResult<BorrowType, K, V, FoundType, GoDownType> {
    Found(Handle<NodeRef<BorrowType, K, V, FoundType>, marker::KV>),
    GoDown(Handle<NodeRef<BorrowType, K, V, GoDownType>, marker::Edge>),
}

pub(super) enum IndexResult {
    KV(usize),
    Edge(usize),
}

impl<BorrowType: marker::BorrowType, K, V> NodeRef<BorrowType, K, V, marker::LeafOrInternal> {
    /// 递归地在由节点领导的（子）树中查找给定键。
    /// Returns a `Found` with the handle of the matching KV, if any. Otherwise,
    /// returns a `GoDown` with the handle of the leaf edge where the key belongs.
    ///
    /// 结果只有在树按键排序的情况下才有意义，就像那棵树一样。
    /// in a `BTreeMap` is.
    pub(super) fn search_tree<Q: ?Sized>(
        mut self,
        key: &Q,
    ) -> SearchResult<BorrowType, K, V, marker::LeafOrInternal, marker::Leaf>
    where
        Q: Ord,
        K: Borrow<Q>,
    {
        loop {
            self = match self.search_node(key) {
                Found(handle) => return Found(handle),
                GoDown(handle) => match handle.force() {
                    Leaf(leaf) => return GoDown(leaf),
                    Internal(internal) => internal.descend(),
                },
            }
        }
    }

    /// 向下查找到最近的节点，该节点的边与范围的下界不同，即
    /// 与范围的上界不同的边，也就是
    /// 范围内至少有一个键的最近节点。
    ///
    /// If found, returns an `Ok` with that node, the strictly ascending pair of
    /// 用于在子节点中继续搜索的对应边界对，以防
    /// 该节点是内部节点。
    /// the node is internal.
    ///
    /// If not found, returns an `Err` with the leaf edge matching the entire
    /// 结果只有在树按键排序的情况下才有意义。
    ///
    /// 在节点中查找与范围下界对应的边。
    ///
    /// The result is meaningful only if the tree is ordered by key.
    pub(super) fn search_tree_for_bifurcation<'r, Q: ?Sized, R>(
        mut self,
        range: &'r R,
    ) -> Result<
        (
            NodeRef<BorrowType, K, V, marker::LeafOrInternal>,
            usize,
            usize,
            SearchBound<&'r Q>,
            SearchBound<&'r Q>,
        ),
        Handle<NodeRef<BorrowType, K, V, marker::Leaf>, marker::Edge>,
    >
    where
        Q: Ord,
        K: Borrow<Q>,
        R: RangeBounds<Q>,
    {
        // Determine if map or set is being searched
        let is_set = <V as super::set_val::IsSetVal>::is_set_val();

        // Inlining these variables should be avoided. We assume the bounds reported by `range`
        // remain the same, but an adversarial implementation could change between calls (#81138).
        let (start, end) = (range.start_bound(), range.end_bound());
        match (start, end) {
            (Bound::Excluded(s), Bound::Excluded(e)) if s == e => {
                if is_set {
                    panic!("range start and end are equal and excluded in BTreeSet")
                } else {
                    panic!("range start and end are equal and excluded in BTreeMap")
                }
            }
            (Bound::Included(s) | Bound::Excluded(s), Bound::Included(e) | Bound::Excluded(e))
                if s > e =>
            {
                if is_set {
                    panic!("range start is greater than range end in BTreeSet")
                } else {
                    panic!("range start is greater than range end in BTreeMap")
                }
            }
            _ => {}
        }
        let mut lower_bound = SearchBound::from_range(start);
        let mut upper_bound = SearchBound::from_range(end);
        loop {
            let (lower_edge_idx, lower_child_bound) = self.find_lower_bound_index(lower_bound);
            let (upper_edge_idx, upper_child_bound) =
                // ignore-tidy-undocumented-unsafe
                unsafe { self.find_upper_bound_index(upper_bound, lower_edge_idx) };
            if lower_edge_idx < upper_edge_idx {
                return Ok((
                    self,
                    lower_edge_idx,
                    upper_edge_idx,
                    lower_child_bound,
                    upper_child_bound,
                ));
            }
            debug_assert_eq!(lower_edge_idx, upper_edge_idx);
            // ignore-tidy-undocumented-unsafe
            let common_edge = unsafe { Handle::new_edge(self, lower_edge_idx) };
            match common_edge.force() {
                Leaf(common_edge) => return Err(common_edge),
                Internal(common_edge) => {
                    self = common_edge.descend();
                    lower_bound = lower_child_bound;
                    upper_bound = upper_child_bound;
                }
            }
        }
    }

    /// 结果只有在树按键排序的情况下才有意义。
    /// Also returns the lower bound to be used for continuing the search in
    /// the matching child node, if `self` is an internal node.
    ///
    /// 结果只有在树按键排序的情况下才有意义。
    pub(super) fn find_lower_bound_edge<'r, Q>(
        self,
        bound: SearchBound<&'r Q>,
    ) -> (Handle<Self, marker::Edge>, SearchBound<&'r Q>)
    where
        Q: ?Sized + Ord,
        K: Borrow<Q>,
    {
        let (edge_idx, bound) = self.find_lower_bound_index(bound);
        // ignore-tidy-undocumented-unsafe
        let edge = unsafe { Handle::new_edge(self, edge_idx) };
        (edge, bound)
    }

    /// Clone of `find_lower_bound_edge` for the upper bound.
    pub(super) fn find_upper_bound_edge<'r, Q>(
        self,
        bound: SearchBound<&'r Q>,
    ) -> (Handle<Self, marker::Edge>, SearchBound<&'r Q>)
    where
        Q: ?Sized + Ord,
        K: Borrow<Q>,
    {
        // ignore-tidy-undocumented-unsafe
        let (edge_idx, bound) = unsafe { self.find_upper_bound_index(bound, 0) };
        // ignore-tidy-undocumented-unsafe
        let edge = unsafe { Handle::new_edge(self, edge_idx) };
        (edge, bound)
    }
}

impl<BorrowType, K, V, Type> NodeRef<BorrowType, K, V, Type> {
    /// 不递归地查找节点中的给定键。
    /// Returns a `Found` with the handle of the matching KV, if any. Otherwise,
    /// returns a `GoDown` with the handle of the edge where the key might be found
    /// （如果节点是内部节点）或键可以插入的位置。
    ///
    /// 结果只有在树按键排序的情况下才有意义，就像那棵树一样。
    /// in a `BTreeMap` is.
    pub(super) fn search_node<Q: ?Sized>(
        self,
        key: &Q,
    ) -> SearchResult<BorrowType, K, V, Type, Type>
    where
        Q: Ord,
        K: Borrow<Q>,
    {
        // ignore-tidy-undocumented-unsafe
        match unsafe { self.find_key_index(key, 0) } {
            // ignore-tidy-undocumented-unsafe
            IndexResult::KV(idx) => Found(unsafe { Handle::new_kv(self, idx) }),
            // ignore-tidy-undocumented-unsafe
            IndexResult::Edge(idx) => GoDown(unsafe { Handle::new_edge(self, idx) }),
        }
    }

    /// 返回节点中键（或等效项）存在的 KV 索引，或从特定索引开始键所在的边索引。
    /// 结果只有在树按键排序的情况下才有意义，就像那棵树一样。
    ///
    /// 结果只有在树按键排序的情况下才有意义，就像那棵树一样。
    /// in a `BTreeMap` is.
    ///
    /// # 安全性
    /// `start_index` must be a valid edge index for the node.
    unsafe fn find_key_index<Q: ?Sized>(&self, key: &Q, start_index: usize) -> IndexResult
    where
        Q: Ord,
        K: Borrow<Q>,
    {
        let node = self.reborrow();
        let keys = node.keys();
        debug_assert!(start_index <= keys.len());
        // ignore-tidy-undocumented-unsafe
        for (offset, k) in unsafe { keys.get_unchecked(start_index..) }.iter().enumerate() {
            match key.cmp(k.borrow()) {
                Ordering::Greater => {}
                Ordering::Equal => return IndexResult::KV(start_index + offset),
                Ordering::Less => return IndexResult::Edge(start_index + offset),
            }
        }
        IndexResult::Edge(keys.len())
    }

    /// 在节点中查找范围下界对应的边索引。
    /// Also returns the lower bound to be used for continuing the search in
    /// the matching child node, if `self` is an internal node.
    ///
    /// 只有当树按键排序时，结果才有意义。
    fn find_lower_bound_index<'r, Q>(
        &self,
        bound: SearchBound<&'r Q>,
    ) -> (usize, SearchBound<&'r Q>)
    where
        Q: ?Sized + Ord,
        K: Borrow<Q>,
    {
        match bound {
            // ignore-tidy-undocumented-unsafe
            Included(key) => match unsafe { self.find_key_index(key, 0) } {
                IndexResult::KV(idx) => (idx, AllExcluded),
                IndexResult::Edge(idx) => (idx, bound),
            },
            // ignore-tidy-undocumented-unsafe
            Excluded(key) => match unsafe { self.find_key_index(key, 0) } {
                IndexResult::KV(idx) => (idx + 1, AllIncluded),
                IndexResult::Edge(idx) => (idx, bound),
            },
            AllIncluded => (0, AllIncluded),
            AllExcluded => (self.len(), AllExcluded),
        }
    }

    /// Mirror image of `find_lower_bound_index` for the upper bound,
    /// 并增加了一个参数来跳过部分键数组。
    ///
    /// # 安全性
    /// `start_index` must be a valid edge index for the node.
    unsafe fn find_upper_bound_index<'r, Q>(
        &self,
        bound: SearchBound<&'r Q>,
        start_index: usize,
    ) -> (usize, SearchBound<&'r Q>)
    where
        Q: ?Sized + Ord,
        K: Borrow<Q>,
    {
        match bound {
            // ignore-tidy-undocumented-unsafe
            Included(key) => match unsafe { self.find_key_index(key, start_index) } {
                IndexResult::KV(idx) => (idx + 1, AllExcluded),
                IndexResult::Edge(idx) => (idx, bound),
            },
            // ignore-tidy-undocumented-unsafe
            Excluded(key) => match unsafe { self.find_key_index(key, start_index) } {
                IndexResult::KV(idx) => (idx, AllIncluded),
                IndexResult::Edge(idx) => (idx, bound),
            },
            AllIncluded => (self.len(), AllIncluded),
            AllExcluded => (start_index, AllExcluded),
        }
    }
}
