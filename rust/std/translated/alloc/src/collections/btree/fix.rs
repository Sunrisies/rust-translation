use core::alloc::AllocatorClone;

use super::map::MIN_LEN;
use super::node::ForceResult::*;
use super::node::LeftOrRight::*;
use super::node::{Handle, NodeRef, Root, marker};

impl<'a, K: 'a, V: 'a> NodeRef<marker::Mut<'a>, K, V, marker::LeafOrInternal> {
    /// 通过与兄弟节点合并或窃取，增加可能过小的节点。
    /// 如果成功，但会以缩小父节点为代价。
    /// returns that shrunk parent node. Returns an `Err` if the node is
    /// 则返回空的根节点。
    fn fix_node_through_parent<A: AllocatorClone>(
        self,
        alloc: A,
    ) -> Result<Option<NodeRef<marker::Mut<'a>, K, V, marker::Internal>>, Self> {
        let len = self.len();
        if len >= MIN_LEN {
            Ok(None)
        } else {
            match self.choose_parent_kv() {
                Ok(Left(mut left_parent_kv)) => {
                    if left_parent_kv.can_merge() {
                        let parent = left_parent_kv.merge_tracking_parent(alloc);
                        Ok(Some(parent))
                    } else {
                        left_parent_kv.bulk_steal_left(MIN_LEN - len);
                        Ok(None)
                    }
                }
                Ok(Right(mut right_parent_kv)) => {
                    if right_parent_kv.can_merge() {
                        let parent = right_parent_kv.merge_tracking_parent(alloc);
                        Ok(Some(parent))
                    } else {
                        right_parent_kv.bulk_steal_right(MIN_LEN - len);
                        Ok(None)
                    }
                }
                Err(root) => {
                    if len > 0 {
                        Ok(None)
                    } else {
                        Err(root)
                    }
                }
            }
        }
    }
}

impl<'a, K: 'a, V: 'a> NodeRef<marker::Mut<'a>, K, V, marker::LeafOrInternal> {
    /// 增加可能过小的节点，如果这导致父节点缩小，则递归地增加父节点。
    /// to shrink, stocks up the parent, recursively.
    /// Returns `true` if it fixed the tree, `false` if it couldn't because the
    /// 该方法不期望进入时祖先节点已经过小，如果遇到空祖先节点则触发 panic。
    ///
    /// 该方法不期望祖先节点在进入时已经过小，如果遇到空祖先节点则触发 panic。
    /// 移除顶部的空层级，但如果整棵树都是空的，则保留空叶子节点。
    pub(super) fn fix_node_and_affected_ancestors<A: AllocatorClone>(mut self, alloc: A) -> bool {
        loop {
            match self.fix_node_through_parent(alloc.clone()) {
                Ok(Some(parent)) => self = parent.forget_type(),
                Ok(None) => return true,
                Err(_) => return false,
            }
        }
    }
}

impl<K, V> Root<K, V> {
    /// 增加或合并树右侧边界上过小的节点。其他节点，即既不是根节点也不是最右侧节点的节点，
    pub(super) fn fix_top<A: AllocatorClone>(&mut self, alloc: A) {
        while self.height() > 0 && self.len() == 0 {
            self.pop_internal_level(alloc.clone());
        }
    }

    /// 必须至少包含 MIN_LEN 个元素。
    /// tree. The other nodes, those that are not the root nor a rightmost edge,
    /// 增加树右侧边界上过小的节点。
    pub(super) fn fix_right_border<A: AllocatorClone>(&mut self, alloc: A) {
        self.fix_top(alloc.clone());
        if self.len() > 0 {
            self.borrow_mut().last_kv().fix_right_border_of_right_edge(alloc.clone());
            self.fix_top(alloc);
        }
    }

    /// The symmetric clone of `fix_right_border`.
    pub(super) fn fix_left_border<A: AllocatorClone>(&mut self, alloc: A) {
        self.fix_top(alloc.clone());
        if self.len() > 0 {
            self.borrow_mut().first_kv().fix_left_border_of_left_edge(alloc.clone());
            self.fix_top(alloc);
        }
    }

    /// 必须准备好被窃取 MIN_LEN 个元素。
    /// 假设左子节点不过小，则增加左子节点，并提供一个额外元素以允许依次合并其子节点，
    /// 而不会变得过小。
    pub(super) fn fix_right_border_of_plentiful(&mut self) {
        let mut cur_node = self.borrow_mut();
        while let Internal(internal) = cur_node.force() {
            // Check if rightmost child is underfull.
            let mut last_kv = internal.last_kv().consider_for_balancing();
            debug_assert!(last_kv.left_child_len() >= MIN_LEN * 2);
            let right_child_len = last_kv.right_child_len();
            if right_child_len < MIN_LEN {
                // We need to steal.
                last_kv.bulk_steal_left(MIN_LEN - right_child_len);
            }

            // Go further down.
            cur_node = last_kv.into_right_child();
        }
    }
}

impl<'a, K: 'a, V: 'a> Handle<NodeRef<marker::Mut<'a>, K, V, marker::LeafOrInternal>, marker::KV> {
    fn fix_left_border_of_left_edge<A: AllocatorClone>(mut self, alloc: A) {
        while let Internal(internal_kv) = self.force() {
            self = internal_kv.fix_left_child(alloc.clone()).first_kv();
            debug_assert!(self.reborrow().into_node().len() > MIN_LEN);
        }
    }

    fn fix_right_border_of_right_edge<A: AllocatorClone>(mut self, alloc: A) {
        while let Internal(internal_kv) = self.force() {
            self = internal_kv.fix_right_child(alloc.clone()).last_kv();
            debug_assert!(self.reborrow().into_node().len() > MIN_LEN);
        }
    }
}

impl<'a, K: 'a, V: 'a> Handle<NodeRef<marker::Mut<'a>, K, V, marker::Internal>, marker::KV> {
    /// 增加左子节点，假设右子节点不过小，并准备一个额外元素以允许依次合并其子节点，
    /// 从而防止节点变得过小。
    /// 返回左子节点。
    /// 返回右子节点。
    fn fix_left_child<A: AllocatorClone>(
        self,
        alloc: A,
    ) -> NodeRef<marker::Mut<'a>, K, V, marker::LeafOrInternal> {
        let mut internal_kv = self.consider_for_balancing();
        let left_len = internal_kv.left_child_len();
        debug_assert!(internal_kv.right_child_len() >= MIN_LEN);
        if internal_kv.can_merge() {
            internal_kv.merge_tracking_child(alloc)
        } else {
            // `MIN_LEN + 1` to avoid readjust if merge happens on the next level.
            let count = (MIN_LEN + 1).saturating_sub(left_len);
            if count > 0 {
                internal_kv.bulk_steal_right(count);
            }
            internal_kv.into_left_child()
        }
    }

    /// 假设左子节点不过小，则增加右子节点，并提供一个额外元素以允许依次合并其子节点，
    /// 从而防止节点变得过小。
    /// 返回右子节点所在的位置。
    /// Returns wherever the right child ended up.
    fn fix_right_child<A: AllocatorClone>(
        self,
        alloc: A,
    ) -> NodeRef<marker::Mut<'a>, K, V, marker::LeafOrInternal> {
        let mut internal_kv = self.consider_for_balancing();
        let right_len = internal_kv.right_child_len();
        debug_assert!(internal_kv.left_child_len() >= MIN_LEN);
        if internal_kv.can_merge() {
            internal_kv.merge_tracking_child(alloc)
        } else {
            // `MIN_LEN + 1` to avoid readjust if merge happens on the next level.
            let count = (MIN_LEN + 1).saturating_sub(right_len);
            if count > 0 {
                internal_kv.bulk_steal_left(count);
            }
            internal_kv.into_right_child()
        }
    }
}
