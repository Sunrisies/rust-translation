use core::borrow::Borrow;
use core::ops::RangeBounds;
use core::{hint, ptr};

use super::node::ForceResult::*;
use super::node::{Handle, NodeRef, marker};
use super::search::SearchBound;
use crate::alloc::AllocatorClone;
// `front` and `back` are always both `None` or both `Some`.
pub(super) struct LeafRange<BorrowType, K, V> {
    front: Option<Handle<NodeRef<BorrowType, K, V, marker::Leaf>, marker::Edge>>,
    back: Option<Handle<NodeRef<BorrowType, K, V, marker::Leaf>, marker::Edge>>,
}

impl<'a, K: 'a, V: 'a> Clone for LeafRange<marker::Immut<'a>, K, V> {
    fn clone(&self) -> Self {
        LeafRange { front: self.front.clone(), back: self.back.clone() }
    }
}

impl<B, K, V> Default for LeafRange<B, K, V> {
    fn default() -> Self {
        LeafRange { front: None, back: None }
    }
}

impl<BorrowType, K, V> LeafRange<BorrowType, K, V> {
    pub(super) fn none() -> Self {
        LeafRange { front: None, back: None }
    }

    fn is_empty(&self) -> bool {
        self.front == self.back
    }

    /// 临时取出另一个相同范围的不可变等价物。
    pub(super) fn reborrow(&self) -> LeafRange<marker::Immut<'_>, K, V> {
        LeafRange {
            front: self.front.as_ref().map(|f| f.reborrow()),
            back: self.back.as_ref().map(|b| b.reborrow()),
        }
    }
}

impl<'a, K, V> LeafRange<marker::Immut<'a>, K, V> {
    #[inline]
    pub(super) fn next_checked(&mut self) -> Option<(&'a K, &'a V)> {
        self.perform_next_checked(|kv| kv.into_kv())
    }

    #[inline]
    pub(super) fn next_back_checked(&mut self) -> Option<(&'a K, &'a V)> {
        self.perform_next_back_checked(|kv| kv.into_kv())
    }
}

impl<'a, K, V> LeafRange<marker::ValMut<'a>, K, V> {
    #[inline]
    pub(super) fn next_checked(&mut self) -> Option<(&'a K, &'a mut V)> {
        // ignore-tidy-undocumented-unsafe
        self.perform_next_checked(|kv| unsafe { ptr::read(kv) }.into_kv_valmut())
    }

    #[inline]
    pub(super) fn next_back_checked(&mut self) -> Option<(&'a K, &'a mut V)> {
        // ignore-tidy-undocumented-unsafe
        self.perform_next_back_checked(|kv| unsafe { ptr::read(kv) }.into_kv_valmut())
    }
}

impl<BorrowType: marker::BorrowType, K, V> LeafRange<BorrowType, K, V> {
    /// 如果可能，从后续的 KV 中提取一些结果并移动到其外侧。
    fn perform_next_checked<F, R>(&mut self, f: F) -> Option<R>
    where
        F: Fn(&Handle<NodeRef<BorrowType, K, V, marker::LeafOrInternal>, marker::KV>) -> R,
    {
        if self.is_empty() {
            None
        } else {
            // SAFETY: The range is nonempty, so there is an unvisited KV before the back cursor.
            Some(unsafe { self.front.as_mut().unwrap().perform_next_unchecked(f) })
        }
    }

    /// 如果可能，从前文的 KV 中提取一些结果并移动到其外侧。
    fn perform_next_back_checked<F, R>(&mut self, f: F) -> Option<R>
    where
        F: Fn(&Handle<NodeRef<BorrowType, K, V, marker::LeafOrInternal>, marker::KV>) -> R,
    {
        if self.is_empty() {
            None
        } else {
            // SAFETY: The range is nonempty, so there is an unvisited KV before the front cursor.
            Some(unsafe { self.back.as_mut().unwrap().perform_next_back_unchecked(f) })
        }
    }
}

enum LazyLeafHandle<BorrowType, K, V> {
    Root(NodeRef<BorrowType, K, V, marker::LeafOrInternal>), // not yet descended
    Edge(Handle<NodeRef<BorrowType, K, V, marker::Leaf>, marker::Edge>),
}

impl<'a, K: 'a, V: 'a> Clone for LazyLeafHandle<marker::Immut<'a>, K, V> {
    fn clone(&self) -> Self {
        match self {
            LazyLeafHandle::Root(root) => LazyLeafHandle::Root(*root),
            LazyLeafHandle::Edge(edge) => LazyLeafHandle::Edge(*edge),
        }
    }
}

impl<BorrowType, K, V> LazyLeafHandle<BorrowType, K, V> {
    fn reborrow(&self) -> LazyLeafHandle<marker::Immut<'_>, K, V> {
        match self {
            LazyLeafHandle::Root(root) => LazyLeafHandle::Root(root.reborrow()),
            LazyLeafHandle::Edge(edge) => LazyLeafHandle::Edge(edge.reborrow()),
        }
    }
}

// `front` and `back` are always both `None` or both `Some`.
pub(super) struct LazyLeafRange<BorrowType, K, V> {
    front: Option<LazyLeafHandle<BorrowType, K, V>>,
    back: Option<LazyLeafHandle<BorrowType, K, V>>,
}

impl<B, K, V> Default for LazyLeafRange<B, K, V> {
    fn default() -> Self {
        LazyLeafRange { front: None, back: None }
    }
}

impl<'a, K: 'a, V: 'a> Clone for LazyLeafRange<marker::Immut<'a>, K, V> {
    fn clone(&self) -> Self {
        LazyLeafRange { front: self.front.clone(), back: self.back.clone() }
    }
}

impl<BorrowType, K, V> LazyLeafRange<BorrowType, K, V> {
    pub(super) fn none() -> Self {
        LazyLeafRange { front: None, back: None }
    }

    /// 临时取出另一个相同范围的不可变等价物。
    pub(super) fn reborrow(&self) -> LazyLeafRange<marker::Immut<'_>, K, V> {
        LazyLeafRange {
            front: self.front.as_ref().map(|f| f.reborrow()),
            back: self.back.as_ref().map(|b| b.reborrow()),
        }
    }
}

impl<'a, K, V> LazyLeafRange<marker::Immut<'a>, K, V> {
    #[inline]
    pub(super) unsafe fn next_unchecked(&mut self) -> (&'a K, &'a V) {
        // SAFETY: Upheld by caller.
        unsafe { self.init_front().unwrap().next_unchecked() }
    }

    #[inline]
    pub(super) unsafe fn next_back_unchecked(&mut self) -> (&'a K, &'a V) {
        // SAFETY: Upheld by caller.
        unsafe { self.init_back().unwrap().next_back_unchecked() }
    }
}

impl<'a, K, V> LazyLeafRange<marker::ValMut<'a>, K, V> {
    #[inline]
    pub(super) unsafe fn next_unchecked(&mut self) -> (&'a K, &'a mut V) {
        // SAFETY: Upheld by caller.
        unsafe { self.init_front().unwrap().next_unchecked() }
    }

    #[inline]
    pub(super) unsafe fn next_back_unchecked(&mut self) -> (&'a K, &'a mut V) {
        // SAFETY: Upheld by caller.
        unsafe { self.init_back().unwrap().next_back_unchecked() }
    }
}

impl<K, V> LazyLeafRange<marker::Dying, K, V> {
    fn take_front(
        &mut self,
    ) -> Option<Handle<NodeRef<marker::Dying, K, V, marker::Leaf>, marker::Edge>> {
        match self.front.take()? {
            LazyLeafHandle::Root(root) => Some(root.first_leaf_edge()),
            LazyLeafHandle::Edge(edge) => Some(edge),
        }
    }

    #[inline]
    pub(super) unsafe fn deallocating_next_unchecked<A: AllocatorClone>(
        &mut self,
        alloc: A,
    ) -> Handle<NodeRef<marker::Dying, K, V, marker::LeafOrInternal>, marker::KV> {
        debug_assert!(self.front.is_some());
        let front = self.init_front().unwrap();
        // ignore-tidy-undocumented-unsafe
        unsafe { front.deallocating_next_unchecked(alloc) }
    }

    #[inline]
    pub(super) unsafe fn deallocating_next_back_unchecked<A: AllocatorClone>(
        &mut self,
        alloc: A,
    ) -> Handle<NodeRef<marker::Dying, K, V, marker::LeafOrInternal>, marker::KV> {
        debug_assert!(self.back.is_some());
        let back = self.init_back().unwrap();
        // ignore-tidy-undocumented-unsafe
        unsafe { back.deallocating_next_back_unchecked(alloc) }
    }

    #[inline]
    pub(super) fn deallocating_end<A: AllocatorClone>(&mut self, alloc: A) {
        if let Some(front) = self.take_front() {
            front.deallocating_end(alloc)
        }
    }
}

impl<BorrowType: marker::BorrowType, K, V> LazyLeafRange<BorrowType, K, V> {
    fn init_front(
        &mut self,
    ) -> Option<&mut Handle<NodeRef<BorrowType, K, V, marker::Leaf>, marker::Edge>> {
        if let Some(LazyLeafHandle::Root(root)) = &self.front {
            // ignore-tidy-undocumented-unsafe
            self.front = Some(LazyLeafHandle::Edge(unsafe { ptr::read(root) }.first_leaf_edge()));
        }
        match &mut self.front {
            None => None,
            Some(LazyLeafHandle::Edge(edge)) => Some(edge),
            // SAFETY: the code above would have replaced it.
            Some(LazyLeafHandle::Root(_)) => unsafe { hint::unreachable_unchecked() },
        }
    }

    fn init_back(
        &mut self,
    ) -> Option<&mut Handle<NodeRef<BorrowType, K, V, marker::Leaf>, marker::Edge>> {
        if let Some(LazyLeafHandle::Root(root)) = &self.back {
            // ignore-tidy-undocumented-unsafe
            self.back = Some(LazyLeafHandle::Edge(unsafe { ptr::read(root) }.last_leaf_edge()));
        }
        match &mut self.back {
            None => None,
            Some(LazyLeafHandle::Edge(edge)) => Some(edge),
            // SAFETY: the code above would have replaced it.
            Some(LazyLeafHandle::Root(_)) => unsafe { hint::unreachable_unchecked() },
        }
    }
}

impl<BorrowType: marker::BorrowType, K, V> NodeRef<BorrowType, K, V, marker::LeafOrInternal> {
    /// 找出树中界定特定范围的不同叶边。
    ///
    /// 如果存在这样的不同叶边，则按升序返回它们。
    /// that a non-zero number of calls to `next_unchecked` on the `front` of
    /// the result and/or calls to `next_back_unchecked` on the `back` of the
    /// 最终会到达相同的叶边。
    ///
    /// If there are no such edges, i.e., if the tree contains no key within
    /// the range, returns an empty `front` and `back`.
    ///
    /// # 安全性
    /// Unless `BorrowType` is `Immut`, do not use the handles to visit the same
    /// 找出树中界定特定范围的一对叶边。
    unsafe fn find_leaf_edges_spanning_range<Q: ?Sized, R>(
        self,
        range: R,
    ) -> LeafRange<BorrowType, K, V>
    where
        Q: Ord,
        K: Borrow<Q>,
        R: RangeBounds<Q>,
    {
        match self.search_tree_for_bifurcation(&range) {
            Err(_) => LeafRange::none(),
            Ok((
                node,
                lower_edge_idx,
                upper_edge_idx,
                mut lower_child_bound,
                mut upper_child_bound,
            )) => {
                // ignore-tidy-undocumented-unsafe
                let mut lower_edge = unsafe { Handle::new_edge(ptr::read(&node), lower_edge_idx) };
                // ignore-tidy-undocumented-unsafe
                let mut upper_edge = unsafe { Handle::new_edge(node, upper_edge_idx) };
                loop {
                    match (lower_edge.force(), upper_edge.force()) {
                        (Leaf(f), Leaf(b)) => return LeafRange { front: Some(f), back: Some(b) },
                        (Internal(f), Internal(b)) => {
                            (lower_edge, lower_child_bound) =
                                f.descend().find_lower_bound_edge(lower_child_bound);
                            (upper_edge, upper_child_bound) =
                                b.descend().find_upper_bound_edge(upper_child_bound);
                        }
                        _ => unreachable!("BTreeMap has different depths"),
                    }
                }
            }
        }
    }
}

fn full_range<BorrowType: marker::BorrowType, K, V>(
    root1: NodeRef<BorrowType, K, V, marker::LeafOrInternal>,
    root2: NodeRef<BorrowType, K, V, marker::LeafOrInternal>,
) -> LazyLeafRange<BorrowType, K, V> {
    LazyLeafRange {
        front: Some(LazyLeafHandle::Root(root1)),
        back: Some(LazyLeafHandle::Root(root2)),
    }
}

impl<'a, K: 'a, V: 'a> NodeRef<marker::Immut<'a>, K, V, marker::LeafOrInternal> {
    /// 找出树中界定特定范围的一对叶边。
    ///
    /// 结果只有在树按键排序时才有意义，例如像这样的树。
    /// in a `BTreeMap` is.
    pub(super) fn range_search<Q, R>(self, range: R) -> LeafRange<marker::Immut<'a>, K, V>
    where
        Q: ?Sized + Ord,
        K: Borrow<Q>,
        R: RangeBounds<Q>,
    {
        // SAFETY: our borrow type is immutable.
        unsafe { self.find_leaf_edges_spanning_range(range) }
    }

    /// 找出界定整棵树的一对叶边。
    pub(super) fn full_range(self) -> LazyLeafRange<marker::Immut<'a>, K, V> {
        full_range(self, self)
    }
}

impl<'a, K: 'a, V: 'a> NodeRef<marker::ValMut<'a>, K, V, marker::LeafOrInternal> {
    /// 将唯一引用拆分为界定指定范围的一对叶边。
    /// 结果是非唯一的引用，允许（某些）修改，必须谨慎使用。
    /// 结果只有在树按键排序时才有意义，例如像这样的树。
    ///
    /// # 安全性
    /// in a `BTreeMap` is.
    ///
    /// # 安全性
    /// 不要使用重复的处理程序两次来访问相同的 KV。
    pub(super) fn range_search<Q, R>(self, range: R) -> LeafRange<marker::ValMut<'a>, K, V>
    where
        Q: ?Sized + Ord,
        K: Borrow<Q>,
        R: RangeBounds<Q>,
    {
        // ignore-tidy-undocumented-unsafe
        unsafe { self.find_leaf_edges_spanning_range(range) }
    }

    /// 将唯一引用拆分为界定整棵树范围的二对叶边。
    /// 结果是非唯一的引用，允许修改（仅值），因此必须谨慎使用。
    /// # 安全性
    pub(super) fn full_range(self) -> LazyLeafRange<marker::ValMut<'a>, K, V> {
        // SAFETY: We duplicate the root NodeRef here -- we will never visit the
        // same KV twice, and never end up with overlapping value references.
        let self2 = unsafe { ptr::read(&self) };
        full_range(self, self2)
    }
}

impl<K, V> NodeRef<marker::Dying, K, V, marker::LeafOrInternal> {
    /// 将唯一引用拆分为界定整棵树范围的二对叶边。
    /// 结果是非唯一的引用，允许大规模破坏性修改，因此必须极其谨慎使用。
    /// used with the utmost care.
    pub(super) fn full_range(self) -> LazyLeafRange<marker::Dying, K, V> {
        // SAFETY: We duplicate the root NodeRef here -- we will never access
        // it in a way that overlaps references obtained from the root.
        let self2 = unsafe { ptr::read(&self) };
        full_range(self, self2)
    }
}

impl<BorrowType: marker::BorrowType, K, V>
    Handle<NodeRef<BorrowType, K, V, marker::Leaf>, marker::Edge>
{
    /// Given a leaf edge handle, returns [`Result::Ok`] with a handle to the neighboring KV
    /// on the right side, which is either in the same leaf node or in an ancestor node.
    /// If the leaf edge is the last one in the tree, returns [`Result::Err`] with the root node.
    pub(super) fn next_kv(
        self,
    ) -> Result<
        Handle<NodeRef<BorrowType, K, V, marker::LeafOrInternal>, marker::KV>,
        NodeRef<BorrowType, K, V, marker::LeafOrInternal>,
    > {
        let mut edge = self.forget_node_type();
        loop {
            edge = match edge.right_kv() {
                Ok(kv) => return Ok(kv),
                Err(last_edge) => match last_edge.into_node().ascend() {
                    Ok(parent_edge) => parent_edge.forget_node_type(),
                    Err(root) => return Err(root),
                },
            }
        }
    }

    /// Given a leaf edge handle, returns [`Result::Ok`] with a handle to the neighboring KV
    /// on the left side, which is either in the same leaf node or in an ancestor node.
    /// If the leaf edge is the first one in the tree, returns [`Result::Err`] with the root node.
    pub(super) fn next_back_kv(
        self,
    ) -> Result<
        Handle<NodeRef<BorrowType, K, V, marker::LeafOrInternal>, marker::KV>,
        NodeRef<BorrowType, K, V, marker::LeafOrInternal>,
    > {
        let mut edge = self.forget_node_type();
        loop {
            edge = match edge.left_kv() {
                Ok(kv) => return Ok(kv),
                Err(last_edge) => match last_edge.into_node().ascend() {
                    Ok(parent_edge) => parent_edge.forget_node_type(),
                    Err(root) => return Err(root),
                },
            }
        }
    }
}

impl<BorrowType: marker::BorrowType, K, V>
    Handle<NodeRef<BorrowType, K, V, marker::Internal>, marker::Edge>
{
    /// Given an internal edge handle, returns [`Result::Ok`] with a handle to the neighboring KV
    /// 在右侧，该节点要么位于同一内部节点，要么位于祖先节点中。
    /// If the internal edge is the last one in the tree, returns [`Result::Err`] with the root node.
    fn next_kv(
        self,
    ) -> Result<
        Handle<NodeRef<BorrowType, K, V, marker::Internal>, marker::KV>,
        NodeRef<BorrowType, K, V, marker::Internal>,
    > {
        let mut edge = self;
        loop {
            edge = match edge.right_kv() {
                Ok(internal_kv) => return Ok(internal_kv),
                Err(last_edge) => match last_edge.into_node().ascend() {
                    Ok(parent_edge) => parent_edge,
                    Err(root) => return Err(root),
                },
            }
        }
    }
}

impl<K, V> Handle<NodeRef<marker::Dying, K, V, marker::Leaf>, marker::Edge> {
    /// 给定一个进入死亡树的叶边句柄，返回下一个叶边
    /// 在右侧，以及中间存在的键值对（如果有的话）。
    ///
    /// 如果给定的边是叶节点中的最后一条，此方法会释放该叶节点
    /// 以及所有最后边被到达的祖先节点。
    /// 这意味着如果没有更多的键值对，整个树
    /// 都将被释放，没有剩余内容可以返回。
    ///
    /// # 安全性
    /// - 给定的边之前不得由对应方法返回
    ///   `deallocating_next_back`.
    /// - 返回的 KV 句柄仅可用于访问键和值，
    ///   and only valid until the next call to a `deallocating_` method.
    unsafe fn deallocating_next<A: AllocatorClone>(
        self,
        alloc: A,
    ) -> Option<(Self, Handle<NodeRef<marker::Dying, K, V, marker::LeafOrInternal>, marker::KV>)>
    {
        let mut edge = self.forget_node_type();
        loop {
            edge = match edge.right_kv() {
                // ignore-tidy-undocumented-unsafe
                Ok(kv) => return Some((unsafe { ptr::read(&kv) }.next_leaf_edge(), kv)),
                Err(last_edge) => {
                    // ignore-tidy-undocumented-unsafe
                    match unsafe { last_edge.into_node().deallocate_and_ascend(alloc.clone()) } {
                        Some(parent_edge) => parent_edge.forget_node_type(),
                        None => return None,
                    }
                }
            }
        }
    }

    /// 给定一个进入死亡树的叶边句柄，返回下一个叶边
    /// 在左侧，以及中间存在的键值对（如果有的话）。
    ///
    /// 如果给定的边是叶节点中的第一条，此方法会释放该叶节点
    /// 以及所有第一条边被到达的祖先节点。
    /// 这意味着如果没有更多的键值对，整个树
    /// 都将被释放，没有剩余内容可以返回。
    ///
    /// # 安全性
    /// - 给定的边之前不得由对应方法返回
    ///   `deallocating_next`.
    /// - 返回的 KV 句柄仅可用于访问键和值，
    ///   and only valid until the next call to a `deallocating_` method.
    unsafe fn deallocating_next_back<A: AllocatorClone>(
        self,
        alloc: A,
    ) -> Option<(Self, Handle<NodeRef<marker::Dying, K, V, marker::LeafOrInternal>, marker::KV>)>
    {
        let mut edge = self.forget_node_type();
        loop {
            edge = match edge.left_kv() {
                // ignore-tidy-undocumented-unsafe
                Ok(kv) => return Some((unsafe { ptr::read(&kv) }.next_back_leaf_edge(), kv)),
                Err(last_edge) => {
                    // ignore-tidy-undocumented-unsafe
                    match unsafe { last_edge.into_node().deallocate_and_ascend(alloc.clone()) } {
                        Some(parent_edge) => parent_edge.forget_node_type(),
                        None => return None,
                    }
                }
            }
        }
    }

    /// 释放从叶节点到根节点的所有节点。
    /// 这是在
    /// `deallocating_next` and `deallocating_next_back` have been nibbling at
    /// 树的两边，并到达同一边之后，释放剩余树部分的唯一方式。正如其设计目的
    /// 仅在所有键和值都被返回时调用，
    /// 不会对任何键或值进行清理操作。
    fn deallocating_end<A: AllocatorClone>(self, alloc: A) {
        let mut edge = self.forget_node_type();
        while let Some(parent_edge) =
            // ignore-tidy-undocumented-unsafe
            unsafe { edge.into_node().deallocate_and_ascend(alloc.clone()) }
        {
            edge = parent_edge.forget_node_type();
        }
    }
}

impl<'a, K, V> Handle<NodeRef<marker::Immut<'a>, K, V, marker::Leaf>, marker::Edge> {
    /// 将叶边句柄移动到下一个叶边，并返回对中间键和值的引用。
    /// # 安全性
    ///
    /// # 安全性
    /// 必须存在朝该方向移动的另一个 KV。
    unsafe fn next_unchecked(&mut self) -> (&'a K, &'a V) {
        // SAFETY: guaranteed by caller
        unsafe { self.perform_next_unchecked(|node| node.into_kv()) }
    }

    /// 将叶边句柄移动到前一个叶边，并返回对中间键和值的引用。
    /// # 安全性
    ///
    /// # 安全性
    /// 必须存在朝该方向移动的另一个 KV。
    unsafe fn next_back_unchecked(&mut self) -> (&'a K, &'a V) {
        // SAFETY: guaranteed by caller
        unsafe { self.perform_next_back_unchecked(|node| node.into_kv()) }
    }
}

impl<'a, K, V> Handle<NodeRef<marker::ValMut<'a>, K, V, marker::Leaf>, marker::Edge> {
    /// 将叶边句柄移动到下一个叶边，并返回对中间键和值的引用。
    /// 中间包含键和值。
    ///
    /// # 安全性
    /// - 所行进的方向上必须存在另一个 KV。
    /// - 此调用返回的 KV 不得被任何其他
    /// 活态可变引用所别名。
    unsafe fn next_unchecked(&mut self) -> (&'a K, &'a mut V) {
        // SAFETY: guaranteed by caller
        unsafe { self.perform_next_unchecked(|kv| ptr::read(kv).into_kv_valmut()) }
    }

    /// 将叶边处理器移动到前一个叶边，并返回对
    /// 键和值的引用。
    ///
    /// # 安全性
    /// - 所行进的方向上必须存在另一个 KV。
    /// - 此调用返回的 KV 不得被任何其他
    /// 活态可变引用所别名。
    unsafe fn next_back_unchecked(&mut self) -> (&'a K, &'a mut V) {
        // SAFETY: guaranteed by caller
        unsafe { self.perform_next_back_unchecked(|kv| ptr::read(kv).into_kv_valmut()) }
    }
}

impl<BorrowType: marker::BorrowType, K, V>
    Handle<NodeRef<BorrowType, K, V, marker::Leaf>, marker::Edge>
{
    /// # 安全性
    /// - 所行进的方向上必须存在另一个 KV。
    /// - 此调用产生的 KV 不得被任何其他
    /// 活态可变引用所别名。
    unsafe fn perform_next_unchecked<F, R>(&mut self, f: F) -> R
    where
        F: Fn(&Handle<NodeRef<BorrowType, K, V, marker::LeafOrInternal>, marker::KV>) -> R,
    {
        let idx = self.idx();
        let len = self.reborrow().into_node().len();
        // The fast path when the next KV is still in the same node
        if idx < len {
            // SAFETY: `self` will be immediately replaced below
            let node = unsafe { ptr::read(self) }.into_node();
            // SAFETY: `idx + 1 <= node.len()`. The copy of `node` is only used
            // to form the next edge; `node` is consumed below to access the current KV.
            *self = unsafe { Handle::new_edge(ptr::read(&node), idx + 1) };
            // SAFETY: `idx < node.len()`.
            f(&unsafe { Handle::new_kv(node, idx) }.forget_node_type())
        } else {
            let kv = super::mem::replace(self, |leaf_edge| {
                let kv = leaf_edge.next_kv().ok().unwrap();
                // SAFETY: The copy of `kv` is only used to form the next edge
                (unsafe { ptr::read(&kv) }.next_leaf_edge(), kv)
            });
            f(&kv)
        }
    }

    /// # 安全性
    /// - 所行进的方向上必须存在另一个 KV。
    /// - 此调用产生的 KV 不得被任何其他
    /// 活态可变引用所别名。
    unsafe fn perform_next_back_unchecked<F, R>(&mut self, f: F) -> R
    where
        F: Fn(&Handle<NodeRef<BorrowType, K, V, marker::LeafOrInternal>, marker::KV>) -> R,
    {
        let idx = self.idx();
        // The fast path when the next KV is still in the same node
        if idx > 0 {
            // SAFETY: `self` will be replaced below
            let node = unsafe { ptr::read(self) }.into_node();
            // SAFETY: `0 <= idx - 1 < node.len()`. The copy of `node` is only used
            // to form the next edge; `node` is consumed below to access the current KV.
            *self = unsafe { Handle::new_edge(ptr::read(&node), idx - 1) };
            // SAFETY: `0 <= idx - 1 < node.len()`
            f(&unsafe { Handle::new_kv(node, idx - 1) }.forget_node_type())
        } else {
            let kv = super::mem::replace(self, |leaf_edge| {
                let kv = leaf_edge.next_back_kv().ok().unwrap();
                // SAFETY: The copy of `kv` is only used to form the next edge
                (unsafe { ptr::read(&kv) }.next_back_leaf_edge(), kv)
            });
            f(&kv)
        }
    }
}

impl<K, V> Handle<NodeRef<marker::Dying, K, V, marker::Leaf>, marker::Edge> {
    /// 将叶边处理器移动到下一个叶边，并返回键和值
    /// 中间的值，同时释放留下的任何节点，导致对应的
    /// 边在其父节点中悬空。
    ///
    /// # 安全性
    /// - 所行进的方向上必须存在另一个 KV。
    /// - 该 KV 之前未被对应对象返回
    ///   `deallocating_next_back_unchecked` on any copy of the handles
    /// 用于遍历树。
    ///
    /// 使用更新后的处理器进行操作的唯一安全方式是比较它、丢弃它，
    /// or call this method or counterpart `deallocating_next_back_unchecked` again.
    unsafe fn deallocating_next_unchecked<A: AllocatorClone>(
        &mut self,
        alloc: A,
    ) -> Handle<NodeRef<marker::Dying, K, V, marker::LeafOrInternal>, marker::KV> {
        // ignore-tidy-undocumented-unsafe
        super::mem::replace(self, |leaf_edge| unsafe {
            leaf_edge.deallocating_next(alloc).unwrap()
        })
    }

    /// 将叶边处理器移动到前一个叶边，并返回键和值
    /// 中间的值，同时释放留下的任何节点，导致对应的
    /// 边在其父节点中悬空。
    ///
    /// # 安全性
    /// - 所行进的方向上必须存在另一个 KV。
    /// - 该叶边之前未被对应对象返回
    ///   `deallocating_next_unchecked` on any copy of the handles
    /// 用于遍历树。
    ///
    /// 使用更新后的处理器进行操作的唯一安全方式是比较它、丢弃它，
    /// or call this method or counterpart `deallocating_next_unchecked` again.
    unsafe fn deallocating_next_back_unchecked<A: AllocatorClone>(
        &mut self,
        alloc: A,
    ) -> Handle<NodeRef<marker::Dying, K, V, marker::LeafOrInternal>, marker::KV> {
        // ignore-tidy-undocumented-unsafe
        super::mem::replace(self, |leaf_edge| unsafe {
            leaf_edge.deallocating_next_back(alloc).unwrap()
        })
    }
}

impl<BorrowType: marker::BorrowType, K, V> NodeRef<BorrowType, K, V, marker::LeafOrInternal> {
    /// 返回节点中最左边的叶边——换句话说，在向前导航时首先需要的边（或向后导航时最后需要的边）。
    /// 在向前导航时，这是你需要首先遇到的边；在向后导航时，这是最后需要的边。
    #[inline]
    pub(super) fn first_leaf_edge(
        self,
    ) -> Handle<NodeRef<BorrowType, K, V, marker::Leaf>, marker::Edge> {
        let mut node = self;
        loop {
            match node.force() {
                Leaf(leaf) => return leaf.first_edge(),
                Internal(internal) => node = internal.first_edge().descend(),
            }
        }
    }

    /// 返回节点中最右边的叶边——换句话说，在向前导航时最后需要的边（或向后导航时首先需要的边）。
    /// 在向前导航时，这是最后需要的边；在向后导航时，这是首先需要的边。
    #[inline]
    pub(super) fn last_leaf_edge(
        self,
    ) -> Handle<NodeRef<BorrowType, K, V, marker::Leaf>, marker::Edge> {
        let mut node = self;
        loop {
            match node.force() {
                Leaf(leaf) => return leaf.last_edge(),
                Internal(internal) => node = internal.last_edge().descend(),
            }
        }
    }
}

pub(super) enum Position<BorrowType, K, V> {
    Leaf(NodeRef<BorrowType, K, V, marker::Leaf>),
    Internal(NodeRef<BorrowType, K, V, marker::Internal>),
    InternalKV,
}

impl<'a, K: 'a, V: 'a> NodeRef<marker::Immut<'a>, K, V, marker::LeafOrInternal> {
    /// 按键升序访问叶节点和内部 KV，并且
    /// 以深度优先顺序整体访问内部节点，意味着
    /// 内部节点在其各自的 KV 及其子节点之前。
    pub(super) fn visit_nodes_in_order<F>(self, mut visit: F)
    where
        F: FnMut(Position<marker::Immut<'a>, K, V>),
    {
        match self.force() {
            Leaf(leaf) => visit(Position::Leaf(leaf)),
            Internal(internal) => {
                visit(Position::Internal(internal));
                let mut edge = internal.first_edge();
                loop {
                    edge = match edge.descend().force() {
                        Leaf(leaf) => {
                            visit(Position::Leaf(leaf));
                            match edge.next_kv() {
                                Ok(kv) => {
                                    visit(Position::InternalKV);
                                    kv.right_edge()
                                }
                                Err(_) => return,
                            }
                        }
                        Internal(internal) => {
                            visit(Position::Internal(internal));
                            internal.first_edge()
                        }
                    }
                }
            }
        }
    }

    /// 计算子树中的元素数量。
    pub(super) fn calc_length(self) -> usize {
        let mut result = 0;
        self.visit_nodes_in_order(|pos| match pos {
            Position::Leaf(node) => result += node.len(),
            Position::Internal(node) => result += node.len(),
            Position::InternalKV => (),
        });
        result
    }
}

impl<BorrowType: marker::BorrowType, K, V>
    Handle<NodeRef<BorrowType, K, V, marker::LeafOrInternal>, marker::KV>
{
    /// 返回用于正向遍历时最接近 KV 的叶边。
    pub(super) fn next_leaf_edge(
        self,
    ) -> Handle<NodeRef<BorrowType, K, V, marker::Leaf>, marker::Edge> {
        match self.force() {
            Leaf(leaf_kv) => leaf_kv.right_edge(),
            Internal(internal_kv) => {
                let next_internal_edge = internal_kv.right_edge();
                next_internal_edge.descend().first_leaf_edge()
            }
        }
    }

    /// 返回用于反向遍历时最接近 KV 的叶边。
    pub(super) fn next_back_leaf_edge(
        self,
    ) -> Handle<NodeRef<BorrowType, K, V, marker::Leaf>, marker::Edge> {
        match self.force() {
            Leaf(leaf_kv) => leaf_kv.left_edge(),
            Internal(internal_kv) => {
                let next_internal_edge = internal_kv.left_edge();
                next_internal_edge.descend().last_leaf_edge()
            }
        }
    }
}

impl<BorrowType: marker::BorrowType, K, V> NodeRef<BorrowType, K, V, marker::LeafOrInternal> {
    /// 返回与第一个满足给定边界条件的点的叶边。
    /// 第一个满足给定边界条件的点。
    pub(super) fn lower_bound<Q: ?Sized>(
        self,
        mut bound: SearchBound<&Q>,
    ) -> Handle<NodeRef<BorrowType, K, V, marker::Leaf>, marker::Edge>
    where
        Q: Ord,
        K: Borrow<Q>,
    {
        let mut node = self;
        loop {
            let (edge, new_bound) = node.find_lower_bound_edge(bound);
            match edge.force() {
                Leaf(edge) => return edge,
                Internal(edge) => {
                    node = edge.descend();
                    bound = new_bound;
                }
            }
        }
    }

    /// 返回与最后一个满足给定边界条件的点的叶边。
    /// 最后一个满足给定边界条件的点。
    pub(super) fn upper_bound<Q: ?Sized>(
        self,
        mut bound: SearchBound<&Q>,
    ) -> Handle<NodeRef<BorrowType, K, V, marker::Leaf>, marker::Edge>
    where
        Q: Ord,
        K: Borrow<Q>,
    {
        let mut node = self;
        loop {
            let (edge, new_bound) = node.find_upper_bound_edge(bound);
            match edge.force() {
                Leaf(edge) => return edge,
                Internal(edge) => {
                    node = edge.descend();
                    bound = new_bound;
                }
            }
        }
    }
}

impl<K, V> NodeRef<marker::Dying, K, V, marker::LeafOrInternal> {
    /// # 安全性
    /// - `self` must be the root.
    /// - 不应再访问该树。
    pub(super) unsafe fn drop_tree<A: AllocatorClone>(self, alloc: A) {
        struct DropGuard<K, V, A: AllocatorClone> {
            node: Option<NodeRef<marker::Dying, K, V, marker::LeafOrInternal>>,
            alloc: A,
        }

        impl<K, V, A: AllocatorClone> Drop for DropGuard<K, V, A> {
            fn drop(&mut self) {
                if let Some(cur) = self.node.take() {
                    let mut next =
                        // SAFETY: When unwinding reached this guard, all kvs in cur
                        // have already been dropped in `drop_kvs`, while the node itself has not
                        // yet been deallocated.
                        unsafe { deallocate_and_next_postorder_node(cur, self.alloc.clone()) };

                    while let Some(mut node) = next {
                        // SAFETY: Every node only calls the function once
                        unsafe { node.drop_kvs() };
                        next =
                            // SAFETY: `drop_kvs()` above only dropped kvs and the node is still accessible,
                            // and also each node is deallocated exactly once.
                            unsafe { deallocate_and_next_postorder_node(node, self.alloc.clone()) }
                    }
                }
            }
        }
        /// Deallocates `node` and returns the next node in postorder traversal
        ///
        /// # 安全性
        ///
        /// 该节点必须已初始化，节点中的所有 KV 必须已经
        /// 被释放或移出，且其子节点也必须已被释放。
        /// 此外，该节点也不能再被操作。
        unsafe fn deallocate_and_next_postorder_node<K, V, A: AllocatorClone>(
            node: NodeRef<marker::Dying, K, V, marker::LeafOrInternal>,
            alloc: A,
        ) -> Option<NodeRef<marker::Dying, K, V, marker::LeafOrInternal>> {
            // SAFETY: guaranteed by the caller
            let parent = unsafe { node.deallocate_and_ascend(alloc) }?;

            Some(match parent.right_kv() {
                Ok(kv) => kv.right_edge().descend().first_leaf_edge().into_node().forget_type(),
                Err(last_edge) => last_edge.into_node().forget_type(),
            })
        }

        let node = self.first_leaf_edge().into_node().forget_type();
        let mut guard = DropGuard { node: Some(node), alloc };
        loop {
            // SAFETY: all kvs of each node are dropped once
            unsafe { guard.node.as_mut().unwrap().drop_kvs() };
            // SAFETY: Nodes are deallocated in postorder, and each node is deallocated exactly once.
            if let Some(next) = unsafe {
                deallocate_and_next_postorder_node(guard.node.take().unwrap(), guard.alloc.clone())
            } {
                guard.node = Some(next);
            } else {
                return;
            }
        }
    }
}
