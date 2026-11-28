// This is an attempt at an implementation following the ideal
//
// ```
// struct BTreeMap<K, V> {
//     height: usize,
//     root: Option<Box<Node<K, V, height>>>
// }
//
// struct Node<K, V, height: usize> {
//     keys: [K; 2 * B - 1],
//     vals: [V; 2 * B - 1],
//     edges: [if height > 0 { Box<Node<K, V, height - 1>> } else { () }; 2 * B],
//     parent: Option<(NonNull<Node<K, V, height + 1>>, u16)>,
//     len: u16,
// }
// ```
//
// Since Rust doesn't actually have dependent types and polymorphic recursion,
// we make do with lots of unsafety.

// A major goal of this module is to avoid complexity by treating the tree as a generic (if
// weirdly shaped) container and avoiding dealing with most of the B-Tree invariants. As such,
// this module doesn't care whether the entries are sorted, which nodes can be underfull, or
// even what underfull means. However, we do rely on a few invariants:
//
// - Trees must have uniform depth/height. This means that every path down to a leaf from a
//   given node has exactly the same length.
// - A node of length `n` has `n` keys, `n` values, and `n + 1` edges.
//   This implies that even an empty node has at least one edge.
//   For a leaf node, "having an edge" only means we can identify a position in the node,
//   since leaf edges are empty and need no data representation. In an internal node,
//   an edge both identifies a position and contains a pointer to a child node.

use core::marker::PhantomData;
use core::mem::{self, MaybeUninit};
use core::num::NonZero;
use core::ptr::{self, NonNull};
use core::slice::SliceIndex;

use crate::alloc::{Allocator, AllocatorClone, Layout};
use crate::boxed::Box;

const B: usize = 6;
pub(super) const CAPACITY: usize = 2 * B - 1;
pub(super) const MIN_LEN_AFTER_SPLIT: usize = B - 1;
const KV_IDX_CENTER: usize = B - 1;
const EDGE_IDX_LEFT_OF_CENTER: usize = B - 1;
const EDGE_IDX_RIGHT_OF_CENTER: usize = B;

/// 叶节点 underlying 表示形式以及内部节点的部分表示形式。
struct LeafNode<K, V> {
    /// We want to be covariant in `K` and `V`.
    parent: Option<NonNull<InternalNode<K, V>>>,

    /// This node's index into the parent node's `edges` array.
    /// `*node.parent.edges[node.parent_idx]` should be the same thing as `node`.
    /// This is only guaranteed to be initialized when `parent` is non-null.
    parent_idx: MaybeUninit<u16>,

    /// 此节点所存储的键和值的数量。
    len: u16,

    /// The arrays storing the actual data of the node. Only the first `len` elements of each
    /// 这些数组被初始化且有效。
    keys: [MaybeUninit<K>; CAPACITY],
    vals: [MaybeUninit<V>; CAPACITY],
}

impl<K, V> LeafNode<K, V> {
    /// Initializes a new `LeafNode` in-place.
    ///
    /// # 安全性
    ///
    /// The caller must ensure that `this` points to a (possibly uninitialized) `LeafNode`
    unsafe fn init(this: *mut Self) {
        // As a general policy, we leave fields uninitialized if they can be, as this should
        // be both slightly faster and easier to track in Valgrind.
        // ignore-tidy-undocumented-unsafe
        unsafe {
            // parent_idx, keys, and vals are all MaybeUninit
            (&raw mut (*this).parent).write(None);
            (&raw mut (*this).len).write(0);
        }
    }

    /// Creates a new boxed `LeafNode`.
    fn new<A: AllocatorClone>(alloc: A) -> Box<Self, A> {
        let mut leaf = Box::new_uninit_in(alloc);

        // SAFETY: `leaf` points to a `LeafNode`.
        unsafe { LeafNode::init(leaf.as_mut_ptr()) };
        // SAFETY: `leaf` was just initialized.
        unsafe { leaf.assume_init() }
    }
}

/// The underlying representation of internal nodes. As with `LeafNode`s, these should be hidden
/// behind `BoxedNode`s to prevent dropping uninitialized keys and values. Any pointer to an
/// `InternalNode` can be directly cast to a pointer to the underlying `LeafNode` portion of the
/// node, allowing code to act on leaf and internal nodes generically without having to even check
/// which of the two a pointer is pointing at. This property is enabled by the use of `repr(C)`.
#[repr(C)]
// gdb_providers.py uses this type name for introspection.
struct InternalNode<K, V> {
    data: LeafNode<K, V>,

    /// The pointers to the children of this node. `len + 1` of these are considered
    /// initialized and valid, except that near the end, while the tree is held
    /// through borrow type `Dying`, some of these pointers are dangling.
    edges: [MaybeUninit<BoxedNode<K, V>>; 2 * B],
}

impl<K, V> InternalNode<K, V> {
    /// Creates a new boxed `InternalNode`.
    ///
    /// # 已初始化且有效的边缘。此函数不会设置这样的边缘。
    /// 一个受管理的、非空的节点指针。这要么是一个拥有的指针指向
    /// initialized and valid edge. This function does not set up
    /// such an edge.
    unsafe fn new<A: AllocatorClone>(alloc: A) -> Box<Self, A> {
        let mut node = Box::<Self, _>::new_uninit_in(alloc);

        // SAFETY: argument points to the `node.data` `LeafNode`.
        unsafe { LeafNode::init(&raw mut (*node.as_mut_ptr()).data) };
        // SAFETY: `node.data` was just initialized and `node.edges` is MaybeUninit.
        unsafe { node.assume_init() }
    }
}

/// 它不是一个独立的类型，也没有析构函数。
/// `LeafNode<K, V>` or an owned pointer to `InternalNode<K, V>`.
///
/// However, `BoxedNode` contains no information as to which of the two types
/// of nodes it actually contains, and, partially due to this lack of information,
/// is not a separate type and has no destructor.
type BoxedNode<K, V> = NonNull<LeafNode<K, V>>;

// N.B. `NodeRef` is always covariant in `K` and `V`, even when the `BorrowType`
// is `Mut`. This is technically wrong, but cannot result in any unsafety due to
// internal use of `NodeRef` because we stay completely generic over `K` and `V`.
// However, whenever a public type wraps `NodeRef`, make sure that it has the
// correct variance.
///
/// A reference to a node.
///
/// 关于键和树结构，但还允许在整棵树中共存许多
/// - `BorrowType`: A dummy type that describes the kind of borrow and carries a lifetime.
///    - When this is `Immut<'a>`, the `NodeRef` acts roughly like `&'a Node`.
///    - When this is `ValMut<'a>`, the `NodeRef` acts roughly like `&'a Node`
/// with respect to keys and tree structure, but also allows many
/// mutable references to values throughout the tree to coexist.
///    - When this is `Mut<'a>`, the `NodeRef` acts roughly like `&'a mut Node`,
/// 尽管插入方法允许拥有对值的可修改指针共存。
///    - When this is `Owned`, the `NodeRef` acts roughly like `Box<Node>`,
/// 但没有析构函数，必须手动清理。
///    - When this is `Dying`, the `NodeRef` still acts roughly like `Box<Node>`,
/// 但具有逐层销毁树结构的方法以及普通方法，
/// 虽然未被标记为不可安全调用，但如果调用不当则可能导致未定义行为。
///   Since any `NodeRef` allows navigating through the tree, `BorrowType`
/// 实际上适用于整个树结构，而不仅仅是节点本身。
/// - `K` and `V`: These are the types of keys and values stored in the nodes.
/// - `Type`: This can be `Leaf`, `Internal`, or `LeafOrInternal`. When this is
///   `Leaf`, the `NodeRef` points to a leaf node, when this is `Internal` the
///   `NodeRef` points to an internal node, and when this is `LeafOrInternal` the
///   `NodeRef` could be pointing to either type of node.
///   `Type` is named `NodeType` when used outside `NodeRef`.
///
/// Both `BorrowType` and `NodeType` restrict what methods we implement, to
/// 以利用静态类型安全。我们在应用这些限制时存在限制：
/// - 对于每种类型参数，我们只能泛型的
/// - For each type parameter, we can only define a method either generically
///   or for one particular type. For example, we cannot define a method like
///   `into_kv` generically for all `BorrowType`, or once for all types that
///   carry a lifetime, because we want it to return `&'a` references.
///   Therefore, we define it only for the least powerful type `Immut<'a>`.
/// - We cannot get implicit coercion from say `Mut<'a>` to `Immut<'a>`.
///   Therefore, we have to explicitly call `reborrow` on a more powerful
///   `NodeRef` in order to reach a method like `into_kv`.
///
/// All methods on `NodeRef` that return some kind of reference, either:
/// - Take `self` by value, and return the lifetime carried by `BorrowType`.
///   Sometimes, to invoke such a method, we need to call `reborrow_mut`.
/// - Take `self` by reference, and (implicitly) return that reference's
///   lifetime, instead of the lifetime carried by `BorrowType`. That way,
///   the borrow checker guarantees that the `NodeRef` remains borrowed as long
/// as the returned reference is used.
/// The methods supporting insert bend this rule by returning a raw pointer,
/// i.e., a reference without any lifetime.
pub(super) struct NodeRef<BorrowType, K, V, Type> {
    /// 节点与叶子层级之间的层级数，a
    /// constant of the node that cannot be entirely described by `Type`, and that
    /// 节点本身不存储该值。我们只需要存储根节点的高度。
    /// 节点，并从中推导出其他所有节点的高度。
    /// Must be zero if `Type` is `Leaf` and non-zero if `Type` is `Internal`.
    height: usize,
    /// The pointer to the leaf or internal node. The definition of `InternalNode`
    /// 确保该指针在任何情况下都是有效的。
    node: NonNull<LeafNode<K, V>>,
    _marker: PhantomData<(BorrowType, Type)>,
}

/// 拥有权的树的根节点。
///
/// 注意，它没有析构函数，必须手动清理。
pub(super) type Root<K, V> = NodeRef<marker::Owned, K, V, marker::LeafOrInternal>;

impl<'a, K: 'a, V: 'a, Type> Copy for NodeRef<marker::Immut<'a>, K, V, Type> {}
impl<'a, K: 'a, V: 'a, Type> Clone for NodeRef<marker::Immut<'a>, K, V, Type> {
    fn clone(&self) -> Self {
        *self
    }
}

unsafe impl<BorrowType, K: Sync, V: Sync, Type> Sync for NodeRef<BorrowType, K, V, Type> {}

unsafe impl<K: Sync, V: Sync, Type> Send for NodeRef<marker::Immut<'_>, K, V, Type> {}
unsafe impl<K: Send, V: Send, Type> Send for NodeRef<marker::Mut<'_>, K, V, Type> {}
unsafe impl<K: Send, V: Send, Type> Send for NodeRef<marker::ValMut<'_>, K, V, Type> {}
unsafe impl<K: Send, V: Send, Type> Send for NodeRef<marker::Owned, K, V, Type> {}
unsafe impl<K: Send, V: Send, Type> Send for NodeRef<marker::Dying, K, V, Type> {}

impl<K, V> NodeRef<marker::Owned, K, V, marker::Leaf> {
    pub(super) fn new_leaf<A: AllocatorClone>(alloc: A) -> Self {
        Self::from_new_leaf(LeafNode::new(alloc))
    }

    fn from_new_leaf<A: AllocatorClone>(leaf: Box<LeafNode<K, V>, A>) -> Self {
        // The allocator must be dropped, not leaked.  See also `BTreeMap::alloc`.
        let (node, _alloc) = Box::into_non_null_with_allocator(leaf);
        NodeRef { height: 0, node, _marker: PhantomData }
    }
}

impl<K, V> NodeRef<marker::Owned, K, V, marker::Internal> {
    /// Creates a new internal (height > 0) `NodeRef`
    fn new_internal<A: AllocatorClone>(child: Root<K, V>, alloc: A) -> Self {
        // ignore-tidy-undocumented-unsafe
        let mut new_node = unsafe { InternalNode::new(alloc) };
        new_node.edges[0].write(child.node);
        NodeRef::from_new_internal(new_node, NonZero::new(child.height + 1).unwrap())
    }

    /// Creates a new internal (height > 0) `NodeRef` from an existing internal node
    fn from_new_internal<A: AllocatorClone>(
        internal: Box<InternalNode<K, V>, A>,
        height: NonZero<usize>,
    ) -> Self {
        // The allocator must be dropped, not leaked.  See also `BTreeMap::alloc`.
        let (node, _alloc) = Box::into_non_null_with_allocator(internal);
        let mut this = NodeRef { height: height.into(), node: node.cast(), _marker: PhantomData };
        this.borrow_mut().correct_all_childrens_parent_links();
        this
    }
}

impl<BorrowType, K, V> NodeRef<BorrowType, K, V, marker::Internal> {
    /// Unpack a node reference that was packed as `NodeRef::parent`.
    fn from_internal(node: NonNull<InternalNode<K, V>>, height: usize) -> Self {
        debug_assert!(height > 0);
        NodeRef { height, node: node.cast(), _marker: PhantomData }
    }
}

impl<BorrowType, K, V> NodeRef<BorrowType, K, V, marker::Internal> {
    /// 暴露内部节点的数据。
    ///
    /// 返回原始指针，以避免破坏对该节点的其他引用。
    fn as_internal_ptr(this: &Self) -> *mut InternalNode<K, V> {
        // SAFETY: the static node type is `Internal`.
        this.node.as_ptr() as *mut InternalNode<K, V>
    }
}

impl<'a, K, V> NodeRef<marker::Mut<'a>, K, V, marker::Internal> {
    /// 借用内部节点数据的独占访问权。
    fn as_internal_mut(&mut self) -> &mut InternalNode<K, V> {
        let ptr = Self::as_internal_ptr(self);
        // ignore-tidy-undocumented-unsafe
        unsafe { &mut *ptr }
    }
}

impl<BorrowType, K, V, Type> NodeRef<BorrowType, K, V, Type> {
    /// 计算节点的长度。即键或值的数量。
    /// The number of edges is `len() + 1`.
    /// 注意，尽管此操作安全，但调用该函数可能会产生副作用
    /// 即破坏由 unsafe 代码创建的可变引用。
    pub(super) fn len(&self) -> usize {
        // SAFETY: We only access the `len` field here. If BorrowType is marker::ValMut,
        // there might be outstanding mutable references to values that we must not invalidate.
        unsafe { usize::from((*Self::as_leaf_ptr(self)).len) }
    }

    /// 返回节点与叶子之间的层级数。零
    /// 高度意味着节点本身是叶子。如果你想象树的结构为
    /// 根在顶部，该数字表示节点出现的海拔。
    /// 如果你想象叶子在顶部，该数字表示树在节点上方延伸的高度。
    /// 暂时移除对同一节点的另一个不可变引用。
    pub(super) fn height(&self) -> usize {
        self.height
    }

    /// 暴露任何叶子或内部节点的叶子部分。
    pub(super) fn reborrow(&self) -> NodeRef<marker::Immut<'_>, K, V, Type> {
        NodeRef { height: self.height, node: self.node, _marker: PhantomData }
    }

    /// 返回原始指针，以避免破坏对该节点的其他引用。
    ///
    /// Returns a raw ptr to avoid invalidating other references to this node.
    fn as_leaf_ptr(this: &Self) -> *mut LeafNode<K, V> {
        // The node must be valid for at least the LeafNode portion.
        // This is not a reference in the NodeRef type because we don't know if
        // it should be unique or shared.
        this.node.as_ptr()
    }
}

impl<BorrowType: marker::BorrowType, K, V, Type> NodeRef<BorrowType, K, V, Type> {
    /// Finds the parent of the current node. Returns `Ok(handle)` if the current
    /// node actually has a parent, where `handle` points to the edge of the parent
    /// that points to the current node. Returns `Err(self)` if the current node has
    /// no parent, giving back the original `NodeRef`.
    ///
    /// The method name assumes you picture trees with the root node on top.
    ///
    /// `edge.descend().ascend().unwrap()` and `node.ascend().unwrap().descend()` should
    /// 在成功时都什么都不做。
    pub(super) fn ascend(
        self,
    ) -> Result<Handle<NodeRef<BorrowType, K, V, marker::Internal>, marker::Edge>, Self> {
        const {
            assert!(BorrowType::TRAVERSAL_PERMIT);
        }

        // We need to use raw pointers to nodes because, if BorrowType is marker::ValMut,
        // there might be outstanding mutable references to values that we must not invalidate.
        let leaf_ptr: *const _ = Self::as_leaf_ptr(&self);
        // ignore-tidy-undocumented-unsafe
        unsafe { (*leaf_ptr).parent }
            .as_ref()
            .map(|parent| Handle {
                node: NodeRef::from_internal(*parent, self.height + 1),
                // ignore-tidy-undocumented-unsafe
                idx: unsafe { usize::from((*leaf_ptr).parent_idx.assume_init()) },
                _marker: PhantomData,
            })
            .ok_or(self)
    }

    pub(super) fn first_edge(self) -> Handle<Self, marker::Edge> {
        // ignore-tidy-undocumented-unsafe
        unsafe { Handle::new_edge(self, 0) }
    }

    pub(super) fn last_edge(self) -> Handle<Self, marker::Edge> {
        let len = self.len();
        // ignore-tidy-undocumented-unsafe
        unsafe { Handle::new_edge(self, len) }
    }

    /// Note that `self` must be nonempty.
    pub(super) fn first_kv(self) -> Handle<Self, marker::KV> {
        let len = self.len();
        assert!(len > 0);
        // ignore-tidy-undocumented-unsafe
        unsafe { Handle::new_kv(self, 0) }
    }

    /// Note that `self` must be nonempty.
    pub(super) fn last_kv(self) -> Handle<Self, marker::KV> {
        let len = self.len();
        assert!(len > 0);
        // ignore-tidy-undocumented-unsafe
        unsafe { Handle::new_kv(self, len - 1) }
    }
}

impl<BorrowType, K, V, Type> NodeRef<BorrowType, K, V, Type> {
    /// 可能是 Public 的 PartialEq 实现，但仅用于此模块。
    fn eq(&self, other: &Self) -> bool {
        let Self { node, height, _marker } = self;
        if node.eq(&other.node) {
            debug_assert_eq!(*height, other.height);
            true
        } else {
            false
        }
    }
}

impl<'a, K: 'a, V: 'a, Type> NodeRef<marker::Immut<'a>, K, V, Type> {
    /// 暴露不可变树中任何叶子或内部节点的叶子部分。
    fn into_leaf(self) -> &'a LeafNode<K, V> {
        let ptr = Self::as_leaf_ptr(&self);
        // SAFETY: there can be no mutable references into this tree borrowed as `Immut`.
        unsafe { &*ptr }
    }

    /// 借用节点中存储的键的访问权。
    pub(super) fn keys(&self) -> &[K] {
        let leaf = self.into_leaf();
        // ignore-tidy-undocumented-unsafe
        unsafe { leaf.keys.get_unchecked(..usize::from(leaf.len)).assume_init_ref() }
    }
}

impl<K, V> NodeRef<marker::Dying, K, V, marker::LeafOrInternal> {
    /// Similar to `ascend`, gets a reference to a node's parent node, but also
    /// 在过程中释放当前节点。这是不安全的，因为
    /// 尽管被释放，当前节点仍然可访问。
    pub(super) unsafe fn deallocate_and_ascend<A: AllocatorClone>(
        self,
        alloc: A,
    ) -> Option<Handle<NodeRef<marker::Dying, K, V, marker::Internal>, marker::Edge>> {
        let height = self.height;
        let node = self.node;
        let ret = self.ascend().ok();
        // ignore-tidy-undocumented-unsafe
        unsafe {
            alloc.deallocate(
                node.cast(),
                if height > 0 {
                    Layout::new::<InternalNode<K, V>>()
                } else {
                    Layout::new::<LeafNode<K, V>>()
                },
            );
        }
        ret
    }
    /// 不释放节点本身，直接删除该节点中的所有 kvs。
    ///
    /// # 安全性
    ///
    /// - 节点中的 kvs 必须已初始化，且在此调用后不得被访问。
    /// - 在该函数运行期间，通过其他路径无法访问节点中的任何 kvs。
    pub(super) unsafe fn drop_kvs(&mut self) {
        struct DropGuard<'a, K, V> {
            node: &'a NodeRef<marker::Dying, K, V, marker::LeafOrInternal>,
            idx: usize,
        }
        impl<'a, K, V> Drop for DropGuard<'a, K, V> {
            fn drop(&mut self) {
                let len = self.node.len();
                for i in self.idx..len {
                    // SAFETY: i < len and the kv has been initialized and
                    // it won't use the i-th kv more than once.
                    unsafe {
                        let kv = Handle::new_kv(ptr::read(self.node), i);
                        kv.drop_key_val();
                    }
                }
            }
        }
        let len = self.len();
        for idx in 0..len {
            // If `kv.drop_key_val()` panics, the guard would drop
            // the rest and skip the panicked kv.
            let guard = DropGuard { node: self, idx: idx + 1 };
            // SAFETY: idx < len and the kv has been initialized and
            // it won't touch the idx-th more than once
            unsafe {
                let kv = Handle::new_kv(ptr::read(self), idx);
                kv.drop_key_val();
            }

            core::mem::forget(guard);
        }
    }
}

impl<'a, K, V, Type> NodeRef<marker::Mut<'a>, K, V, Type> {
    /// 暂时取出对同一节点的另一个可变引用。注意，因为
    /// 该方法非常危险，尤其可能不会立即显现为危险。
    /// 危险。
    ///
    /// 由于可变指针可以在树中任意移动，返回的
    /// 指针很容易导致原始指针悬空、超出范围或违反叠加借用规则而无效。
    /// 借用内部节点或叶节点的叶部分独占访问权。
    // FIXME(@gereeter) consider adding yet another type parameter to `NodeRef`
    // that restricts the use of navigation methods on reborrowed pointers,
    // preventing this unsafety.
    unsafe fn reborrow_mut(&mut self) -> NodeRef<marker::Mut<'_>, K, V, Type> {
        NodeRef { height: self.height, node: self.node, _marker: PhantomData }
    }

    /// 提供对内部节点或叶节点的叶部分的独占访问权。
    fn as_leaf_mut(&mut self) -> &mut LeafNode<K, V> {
        let ptr = Self::as_leaf_ptr(self);
        // SAFETY: we have exclusive access to the entire node.
        unsafe { &mut *ptr }
    }

    /// 提供对内部节点或叶节点的叶部分的独占访问权。
    fn into_leaf_mut(mut self) -> &'a mut LeafNode<K, V> {
        let ptr = Self::as_leaf_ptr(&mut self);
        // SAFETY: we have exclusive access to the entire node.
        unsafe { &mut *ptr }
    }

    /// 返回该节点的休眠副本，其生命周期被消除，之后可以
    /// 重新激活。
    pub(super) fn dormant(&self) -> NodeRef<marker::DormantMut, K, V, Type> {
        NodeRef { height: self.height, node: self.node, _marker: PhantomData }
    }
}

impl<K, V, Type> NodeRef<marker::DormantMut, K, V, Type> {
    /// 恢复到最初捕获的独占借用。
    ///
    /// # 安全性
    ///
    /// The reborrow must have ended, i.e., the reference returned by `new` and
    /// 所有由此派生出的指针和引用不得再被使用。
    pub(super) unsafe fn awaken<'a>(self) -> NodeRef<marker::Mut<'a>, K, V, Type> {
        NodeRef { height: self.height, node: self.node, _marker: PhantomData }
    }
}

impl<K, V, Type> NodeRef<marker::Dying, K, V, Type> {
    /// 借用垂死内部节点或叶节点的叶部分的独占访问权。
    fn as_leaf_dying(&mut self) -> &mut LeafNode<K, V> {
        let ptr = Self::as_leaf_ptr(self);
        // SAFETY: we have exclusive access to the entire node.
        unsafe { &mut *ptr }
    }
}

impl<'a, K: 'a, V: 'a, Type> NodeRef<marker::Mut<'a>, K, V, Type> {
    /// 借用键存储区域中元素的独占访问权。
    ///
    /// # 安全性
    /// `index` is in bounds of 0..CAPACITY
    unsafe fn key_area_mut<I, Output: ?Sized>(&mut self, index: I) -> &mut Output
    where
        I: SliceIndex<[MaybeUninit<K>], Output = Output>,
    {
        // SAFETY: the caller will not be able to call further methods on self
        // until the key slice reference is dropped, as we have unique access
        // for the lifetime of the borrow.
        unsafe { self.as_leaf_mut().keys.as_mut_slice().get_unchecked_mut(index) }
    }

    /// 借用节点值存储区域的元素或切片的独占访问权。
    ///
    /// # 安全性
    /// `index` is in bounds of 0..CAPACITY
    unsafe fn val_area_mut<I, Output: ?Sized>(&mut self, index: I) -> &mut Output
    where
        I: SliceIndex<[MaybeUninit<V>], Output = Output>,
    {
        // SAFETY: the caller will not be able to call further methods on self
        // until the value slice reference is dropped, as we have unique access
        // for the lifetime of the borrow.
        unsafe { self.as_leaf_mut().vals.as_mut_slice().get_unchecked_mut(index) }
    }
}

impl<'a, K: 'a, V: 'a> NodeRef<marker::Mut<'a>, K, V, marker::Internal> {
    /// 借用节点存储区域中边缘内容的元素或切片的独占访问权。
    ///
    /// # 安全性
    /// `index` is in bounds of 0..CAPACITY + 1
    unsafe fn edge_area_mut<I, Output: ?Sized>(&mut self, index: I) -> &mut Output
    where
        I: SliceIndex<[MaybeUninit<BoxedNode<K, V>>], Output = Output>,
    {
        // SAFETY: the caller will not be able to call further methods on self
        // until the edge slice reference is dropped, as we have unique access
        // for the lifetime of the borrow.
        unsafe { self.as_internal_mut().edges.as_mut_slice().get_unchecked_mut(index) }
    }
}

impl<'a, K, V, Type> NodeRef<marker::ValMut<'a>, K, V, Type> {
    /// # 安全性
    /// - The node has more than `idx` initialized elements.
    unsafe fn into_key_val_mut_at(mut self, idx: usize) -> (&'a K, &'a mut V) {
        // We only create a reference to the one element we are interested in,
        // to avoid aliasing with outstanding references to other elements,
        // in particular, those returned to the caller in earlier iterations.
        let leaf = Self::as_leaf_ptr(&mut self);
        // ignore-tidy-undocumented-unsafe
        let keys = unsafe { &raw const (*leaf).keys };
        // ignore-tidy-undocumented-unsafe
        let vals = unsafe { &raw mut (*leaf).vals };
        // We must coerce to unsized array pointers because of Rust issue #74679.
        let keys: *const [_] = keys;
        let vals: *mut [_] = vals;
        // ignore-tidy-undocumented-unsafe
        let key = unsafe { (&*keys.get_unchecked(idx)).assume_init_ref() };
        // ignore-tidy-undocumented-unsafe
        let val = unsafe { (&mut *vals.get_unchecked_mut(idx)).assume_init_mut() };
        (key, val)
    }
}

impl<'a, K: 'a, V: 'a, Type> NodeRef<marker::Mut<'a>, K, V, Type> {
    /// 借用节点长度的独占访问权。
    pub(super) fn len_mut(&mut self) -> &mut u16 {
        &mut self.as_leaf_mut().len
    }
}

impl<'a, K, V> NodeRef<marker::Mut<'a>, K, V, marker::Internal> {
    /// # 安全性
    /// Every item returned by `range` is a valid edge index for the node.
    unsafe fn correct_childrens_parent_links<R: Iterator<Item = usize>>(&mut self, range: R) {
        for i in range {
            debug_assert!(i <= self.len());
            // ignore-tidy-undocumented-unsafe
            unsafe { Handle::new_edge(self.reborrow_mut(), i) }.correct_parent_link();
        }
    }

    fn correct_all_childrens_parent_links(&mut self) {
        let len = self.len();
        // ignore-tidy-undocumented-unsafe
        unsafe { self.correct_childrens_parent_links(0..=len) };
    }
}

impl<'a, K: 'a, V: 'a> NodeRef<marker::Mut<'a>, K, V, marker::LeafOrInternal> {
    /// 将节点的链接设置为其父边缘，
    /// 而不使其他对节点的引用失效。
    fn set_parent_link(&mut self, parent: NonNull<InternalNode<K, V>>, parent_idx: usize) {
        let leaf = Self::as_leaf_ptr(self);
        // ignore-tidy-undocumented-unsafe
        unsafe { (*leaf).parent = Some(parent) };
        // ignore-tidy-undocumented-unsafe
        unsafe { (*leaf).parent_idx.write(parent_idx as u16) };
    }
}

impl<K, V> NodeRef<marker::Owned, K, V, marker::LeafOrInternal> {
    /// 清除根节点与其父边缘的链接。
    fn clear_parent_link(&mut self) {
        let mut root_node = self.borrow_mut();
        let leaf = root_node.as_leaf_mut();
        leaf.parent = None;
    }
}

impl<K, V> NodeRef<marker::Owned, K, V, marker::LeafOrInternal> {
    /// 返回一个新的拥有所有权的树，其根节点最初为空。
    pub(super) fn new<A: AllocatorClone>(alloc: A) -> Self {
        NodeRef::new_leaf(alloc).forget_type()
    }

    /// 添加一个新的内部节点，该节点有一个指向前一个根节点的边缘。
    /// 将新节点设为根节点并返回它。这样高度增加 1。
    /// and is the opposite of `pop_internal_level`.
    pub(super) fn push_internal_level<A: AllocatorClone>(
        &mut self,
        alloc: A,
    ) -> NodeRef<marker::Mut<'_>, K, V, marker::Internal> {
        super::mem::take_mut(self, |old_root| NodeRef::new_internal(old_root, alloc).forget_type());

        // `self.borrow_mut()`, except that we just forgot we're internal now:
        NodeRef { height: self.height, node: self.node, _marker: PhantomData }
    }

    /// 移除内部根节点，使用其第一个子节点作为新根节点。
    /// 仅当根节点只有一个子节点时调用此操作。
    /// 不会对任何键、值或其他子节点进行清理操作。
    /// This decreases the height by 1 and is the opposite of `push_internal_level`.
    ///
    /// 不会使指向子树的任何句柄或引用失效。
    /// rooted at the first child of `self`.
    ///
    /// 如果不存在内部层级，即根节点是叶子节点时，会触发 panic。
    pub(super) fn pop_internal_level<A: AllocatorClone>(&mut self, alloc: A) {
        assert!(self.height > 0);

        let top = self.node;

        // SAFETY: we asserted to be internal.
        let mut internal_self = unsafe { self.borrow_mut().cast_to_internal_unchecked() };
        let internal_node = internal_self.as_internal_mut();
        // SAFETY: the first edge is always initialized.
        self.node = unsafe { internal_node.edges[0].assume_init_read() };
        self.height -= 1;
        self.clear_parent_link();

        // ignore-tidy-undocumented-unsafe
        unsafe {
            alloc.deallocate(top.cast(), Layout::new::<InternalNode<K, V>>());
        }
    }
}

impl<K, V, Type> NodeRef<marker::Owned, K, V, Type> {
    /// Mutably borrows the owned root node. Unlike `reborrow_mut`, this is safe
    /// 无法有其他对树的引用。
    /// 略微可修改地借用拥有所有权的根节点。
    pub(super) fn borrow_mut(&mut self) -> NodeRef<marker::Mut<'_>, K, V, Type> {
        NodeRef { height: self.height, node: self.node, _marker: PhantomData }
    }

    /// 不可逆转地转换为允许遍历的引用，并提供
    pub(super) fn borrow_valmut(&mut self) -> NodeRef<marker::ValMut<'_>, K, V, Type> {
        NodeRef { height: self.height, node: self.node, _marker: PhantomData }
    }

    /// 破坏性方法及其他少量功能。
    /// 在节点末尾添加键值对，并返回插入值的句柄。
    pub(super) fn into_dying(self) -> NodeRef<marker::Dying, K, V, Type> {
        NodeRef { height: self.height, node: self.node, _marker: PhantomData }
    }
}

impl<'a, K: 'a, V: 'a> NodeRef<marker::Mut<'a>, K, V, marker::Leaf> {
    /// # 安全性
    /// 返回的句柄具有未绑定生命周期。
    ///
    /// # 在节点末尾添加键值对，并返回
    ///
    /// 插入值的可修改引用。
    pub(super) unsafe fn push_with_handle<'b>(
        &mut self,
        key: K,
        val: V,
    ) -> Handle<NodeRef<marker::Mut<'b>, K, V, marker::Leaf>, marker::KV> {
        let len = self.len_mut();
        let idx = usize::from(*len);
        assert!(idx < CAPACITY);
        *len += 1;
        // ignore-tidy-undocumented-unsafe
        unsafe {
            self.key_area_mut(idx).write(key);
            self.val_area_mut(idx).write(val);
            Handle::new_kv(
                NodeRef { height: self.height, node: self.node, _marker: PhantomData },
                idx,
            )
        }
    }

    /// 添加键值对及指向该对右侧的边。
    /// 到节点末尾。
    pub(super) fn push(&mut self, key: K, val: V) -> *mut V {
        // SAFETY: The unbound handle is no longer accessible.
        unsafe { self.push_with_handle(key, val).into_val_mut() }
    }
}

impl<'a, K: 'a, V: 'a> NodeRef<marker::Mut<'a>, K, V, marker::Internal> {
    /// Adds a key-value pair, and an edge to go to the right of that pair,
    /// to the end of the node.
    pub(super) fn push(&mut self, key: K, val: V, edge: Root<K, V>) {
        assert!(edge.height == self.height - 1);

        let len = self.len_mut();
        let idx = usize::from(*len);
        assert!(idx < CAPACITY);
        *len += 1;
        // ignore-tidy-undocumented-unsafe
        unsafe {
            self.key_area_mut(idx).write(key);
            self.val_area_mut(idx).write(val);
            self.edge_area_mut(idx + 1).write(edge.node);
            Handle::new_edge(self.reborrow_mut(), idx + 1).correct_parent_link();
        }
    }
}

impl<BorrowType, K, V> NodeRef<BorrowType, K, V, marker::Leaf> {
    /// Removes any static information asserting that this node is a `Leaf` node.
    pub(super) fn forget_type(self) -> NodeRef<BorrowType, K, V, marker::LeafOrInternal> {
        NodeRef { height: self.height, node: self.node, _marker: PhantomData }
    }
}

impl<BorrowType, K, V> NodeRef<BorrowType, K, V, marker::Internal> {
    /// Removes any static information asserting that this node is an `Internal` node.
    pub(super) fn forget_type(self) -> NodeRef<BorrowType, K, V, marker::LeafOrInternal> {
        NodeRef { height: self.height, node: self.node, _marker: PhantomData }
    }
}

impl<BorrowType, K, V> NodeRef<BorrowType, K, V, marker::LeafOrInternal> {
    /// Checks whether a node is an `Internal` node or a `Leaf` node.
    pub(super) fn force(
        self,
    ) -> ForceResult<
        NodeRef<BorrowType, K, V, marker::Leaf>,
        NodeRef<BorrowType, K, V, marker::Internal>,
    > {
        if self.height == 0 {
            ForceResult::Leaf(NodeRef {
                height: self.height,
                node: self.node,
                _marker: PhantomData,
            })
        } else {
            ForceResult::Internal(NodeRef {
                height: self.height,
                node: self.node,
                _marker: PhantomData,
            })
        }
    }
}

impl<'a, K, V> NodeRef<marker::Mut<'a>, K, V, marker::LeafOrInternal> {
    /// Unsafely asserts to the compiler the static information that this node is a `Leaf`.
    pub(super) unsafe fn cast_to_leaf_unchecked(
        self,
    ) -> NodeRef<marker::Mut<'a>, K, V, marker::Leaf> {
        debug_assert!(self.height == 0);
        NodeRef { height: self.height, node: self.node, _marker: PhantomData }
    }

    /// Unsafely asserts to the compiler the static information that this node is an `Internal`.
    unsafe fn cast_to_internal_unchecked(self) -> NodeRef<marker::Mut<'a>, K, V, marker::Internal> {
        debug_assert!(self.height > 0);
        NodeRef { height: self.height, node: self.node, _marker: PhantomData }
    }
}

/// A reference to a specific key-value pair or edge within a node. The `Node` parameter
/// must be a `NodeRef`, while the `Type` can either be `KV` (signifying a handle on a key-value
/// pair) or `Edge` (signifying a handle on an edge).
///
/// Note that even `Leaf` nodes can have `Edge` handles. Instead of representing a pointer to
/// a child node, these represent the spaces where child pointers would go between the key-value
/// pairs. For example, in a node with length 2, there would be 3 possible edge locations - one
/// to the left of the node, one between the two pairs, and one at the right of the node.
pub(super) struct Handle<Node, Type> {
    node: Node,
    idx: usize,
    _marker: PhantomData<Type>,
}

impl<Node: Copy, Type> Copy for Handle<Node, Type> {}
// We don't need the full generality of `#[derive(Clone)]`, as the only time `Node` will be
// `Clone`able is when it is an immutable reference and therefore `Copy`.
impl<Node: Copy, Type> Clone for Handle<Node, Type> {
    fn clone(&self) -> Self {
        *self
    }
}

impl<Node, Type> Handle<Node, Type> {
    /// 获取包含此句柄所指向的键值对节点的节点。
    pub(super) fn into_node(self) -> Node {
        self.node
    }

    /// 返回此句柄在节点中的位置。
    pub(super) fn idx(&self) -> usize {
        self.idx
    }
}

impl<BorrowType, K, V, NodeType> Handle<NodeRef<BorrowType, K, V, NodeType>, marker::KV> {
    /// Creates a new handle to a key-value pair in `node`.
    /// Unsafe because the caller must ensure that `idx < node.len()`.
    pub(super) unsafe fn new_kv(node: NodeRef<BorrowType, K, V, NodeType>, idx: usize) -> Self {
        debug_assert!(idx < node.len());

        Handle { node, idx, _marker: PhantomData }
    }

    pub(super) fn left_edge(self) -> Handle<NodeRef<BorrowType, K, V, NodeType>, marker::Edge> {
        // ignore-tidy-undocumented-unsafe
        unsafe { Handle::new_edge(self.node, self.idx) }
    }

    pub(super) fn right_edge(self) -> Handle<NodeRef<BorrowType, K, V, NodeType>, marker::Edge> {
        // ignore-tidy-undocumented-unsafe
        unsafe { Handle::new_edge(self.node, self.idx + 1) }
    }
}

impl<BorrowType, K, V, NodeType, HandleType> PartialEq
    for Handle<NodeRef<BorrowType, K, V, NodeType>, HandleType>
{
    fn eq(&self, other: &Self) -> bool {
        let Self { node, idx, _marker } = self;
        node.eq(&other.node) && *idx == other.idx
    }
}

impl<BorrowType, K, V, NodeType, HandleType>
    Handle<NodeRef<BorrowType, K, V, NodeType>, HandleType>
{
    /// 临时移除同一位置上的另一个不可变句柄。
    pub(super) fn reborrow(
        &self,
    ) -> Handle<NodeRef<marker::Immut<'_>, K, V, NodeType>, HandleType> {
        // We can't use Handle::new_kv or Handle::new_edge because we don't know our type
        Handle { node: self.node.reborrow(), idx: self.idx, _marker: PhantomData }
    }
}

impl<'a, K, V, NodeType, HandleType> Handle<NodeRef<marker::Mut<'a>, K, V, NodeType>, HandleType> {
    /// 临时移除同一位置上的另一个可变句柄。请注意，
    /// 此方法非常危险，尤其是因为它可能不会立即显现出危险。
    /// 危险。
    ///
    /// For details, see `NodeRef::reborrow_mut`.
    pub(super) unsafe fn reborrow_mut(
        &mut self,
    ) -> Handle<NodeRef<marker::Mut<'_>, K, V, NodeType>, HandleType> {
        // We can't use Handle::new_kv or Handle::new_edge because we don't know our type
        // ignore-tidy-undocumented-unsafe
        Handle { node: unsafe { self.node.reborrow_mut() }, idx: self.idx, _marker: PhantomData }
    }

    /// 返回此句柄的休眠副本，之后可以重新激活。
    ///
    /// See `DormantMutRef` for more details.
    pub(super) fn dormant(
        &self,
    ) -> Handle<NodeRef<marker::DormantMut, K, V, NodeType>, HandleType> {
        Handle { node: self.node.dormant(), idx: self.idx, _marker: PhantomData }
    }
}

impl<K, V, NodeType, HandleType> Handle<NodeRef<marker::DormantMut, K, V, NodeType>, HandleType> {
    /// 恢复最初捕获的唯一借用。
    ///
    /// # 安全性
    ///
    /// The reborrow must have ended, i.e., the reference returned by `new` and
    /// 所有由此派生指针和引用不能再被使用。
    pub(super) unsafe fn awaken<'a>(
        self,
    ) -> Handle<NodeRef<marker::Mut<'a>, K, V, NodeType>, HandleType> {
        // ignore-tidy-undocumented-unsafe
        Handle { node: unsafe { self.node.awaken() }, idx: self.idx, _marker: PhantomData }
    }
}

impl<BorrowType, K, V, NodeType> Handle<NodeRef<BorrowType, K, V, NodeType>, marker::Edge> {
    /// Creates a new handle to an edge in `node`.
    /// Unsafe because the caller must ensure that `idx <= node.len()`.
    pub(super) unsafe fn new_edge(node: NodeRef<BorrowType, K, V, NodeType>, idx: usize) -> Self {
        debug_assert!(idx <= node.len());

        Handle { node, idx, _marker: PhantomData }
    }

    pub(super) fn left_kv(
        self,
    ) -> Result<Handle<NodeRef<BorrowType, K, V, NodeType>, marker::KV>, Self> {
        if self.idx > 0 {
            // ignore-tidy-undocumented-unsafe
            Ok(unsafe { Handle::new_kv(self.node, self.idx - 1) })
        } else {
            Err(self)
        }
    }

    pub(super) fn right_kv(
        self,
    ) -> Result<Handle<NodeRef<BorrowType, K, V, NodeType>, marker::KV>, Self> {
        if self.idx < self.node.len() {
            // ignore-tidy-undocumented-unsafe
            Ok(unsafe { Handle::new_kv(self.node, self.idx) })
        } else {
            Err(self)
        }
    }
}

pub(super) enum LeftOrRight<T> {
    Left(T),
    Right(T),
}

/// 当我们在已满的节点中插入时，给定一个边索引，
/// 计算一个合理的 KV 索引点以及插入位置。
/// 分割点的目的是让键和值最终位于父节点中；
/// 分割点左侧的键、值和边成为左子节点；
/// 分割点右侧的键、值和边成为右子节点。
fn splitpoint(edge_idx: usize) -> (usize, LeftOrRight<usize>) {
    debug_assert!(edge_idx <= CAPACITY);
    // Rust issue #74834 tries to explain these symmetric rules.
    match edge_idx {
        0..EDGE_IDX_LEFT_OF_CENTER => (KV_IDX_CENTER - 1, LeftOrRight::Left(edge_idx)),
        EDGE_IDX_LEFT_OF_CENTER => (KV_IDX_CENTER, LeftOrRight::Left(edge_idx)),
        EDGE_IDX_RIGHT_OF_CENTER => (KV_IDX_CENTER, LeftOrRight::Right(0)),
        _ => (KV_IDX_CENTER + 1, LeftOrRight::Right(edge_idx - (KV_IDX_CENTER + 1 + 1))),
    }
}

impl<'a, K: 'a, V: 'a> Handle<NodeRef<marker::Mut<'a>, K, V, marker::Leaf>, marker::Edge> {
    /// 在此边的左右两侧的键值对之间插入新的键值对。此方法假设节点中有足够的空间容纳新对。
    /// 插入新的键值对，并插入一个将位于新对右侧的边。此方法假设
    /// 节点中有足够的空间容纳新对。
    unsafe fn insert_fit(
        mut self,
        key: K,
        val: V,
    ) -> Handle<NodeRef<marker::Mut<'a>, K, V, marker::Leaf>, marker::KV> {
        debug_assert!(self.node.len() < CAPACITY);
        let new_len = self.node.len() + 1;

        // ignore-tidy-undocumented-unsafe
        unsafe {
            slice_insert(self.node.key_area_mut(..new_len), self.idx, key);
            slice_insert(self.node.val_area_mut(..new_len), self.idx, val);
            *self.node.len_mut() = new_len as u16;

            Handle::new_kv(self.node, self.idx)
        }
    }
}

impl<'a, K: 'a, V: 'a> Handle<NodeRef<marker::Mut<'a>, K, V, marker::Leaf>, marker::Edge> {
    /// 在此边的左右两侧的键值对之间插入新的键值对。如果空间不足，此方法会分割节点。
    /// 返回插入节点的休眠句柄，分割完成后可以重新激活。
    ///
    /// 修复此边链接到的子节点中的父指针和索引。当边的顺序发生变化时非常有用。
    /// 插入新的键值对和一个将位于新对右侧的边。此方法假设
    fn insert<A: AllocatorClone>(
        self,
        key: K,
        val: V,
        alloc: A,
    ) -> (
        Option<SplitResult<'a, K, V, marker::Leaf>>,
        Handle<NodeRef<marker::DormantMut, K, V, marker::Leaf>, marker::KV>,
    ) {
        if self.node.len() < CAPACITY {
            // SAFETY: There is enough space in the node for insertion.
            let handle = unsafe { self.insert_fit(key, val) };
            (None, handle.dormant())
        } else {
            let (middle_kv_idx, insertion) = splitpoint(self.idx);
            // ignore-tidy-undocumented-unsafe
            let middle = unsafe { Handle::new_kv(self.node, middle_kv_idx) };
            let mut result = middle.split(alloc);
            let insertion_edge = match insertion {
                // ignore-tidy-undocumented-unsafe
                LeftOrRight::Left(insert_idx) => unsafe {
                    Handle::new_edge(result.left.reborrow_mut(), insert_idx)
                },
                // ignore-tidy-undocumented-unsafe
                LeftOrRight::Right(insert_idx) => unsafe {
                    Handle::new_edge(result.right.borrow_mut(), insert_idx)
                },
            };
            // SAFETY: We just split the node, so there is enough space for
            // insertion.
            let handle = unsafe { insertion_edge.insert_fit(key, val).dormant() };
            (Some(result), handle)
        }
    }
}

impl<'a, K, V> Handle<NodeRef<marker::Mut<'a>, K, V, marker::Internal>, marker::Edge> {
    /// 节点中有足够的空间容纳新对。
    /// 在与此边和该边右侧的键值对之间插入新的键值对和边。此方法假设
    fn correct_parent_link(self) {
        // Create backpointer without invalidating other references to the node.
        // ignore-tidy-undocumented-unsafe
        let ptr = unsafe { NonNull::new_unchecked(NodeRef::as_internal_ptr(&self.node)) };
        let idx = self.idx;
        let mut child = self.descend();
        child.set_parent_link(ptr, idx);
    }
}

impl<'a, K: 'a, V: 'a> Handle<NodeRef<marker::Mut<'a>, K, V, marker::Internal>, marker::Edge> {
    /// 节点中有足够的空间容纳新对。
    /// 在与此边和该边右侧的键值对之间插入新的键值对和边。此方法分割节点。
    /// that there is enough space in the node for the new pair to fit.
    fn insert_fit(&mut self, key: K, val: V, edge: Root<K, V>) {
        debug_assert!(self.node.len() < CAPACITY);
        debug_assert!(edge.height == self.node.height - 1);
        let new_len = self.node.len() + 1;

        // ignore-tidy-undocumented-unsafe
        unsafe {
            slice_insert(self.node.key_area_mut(..new_len), self.idx, key);
            slice_insert(self.node.val_area_mut(..new_len), self.idx, val);
            slice_insert(self.node.edge_area_mut(..new_len + 1), self.idx + 1, edge.node);
            *self.node.len_mut() = new_len as u16;

            self.node.correct_childrens_parent_links(self.idx + 1..new_len + 1);
        }
    }

    /// Inserts a new key-value pair and an edge that will go to the right of that new pair
    /// between this edge and the key-value pair to the right of this edge. This method splits
    /// 如果空间不足，则截断节点。
    fn insert<A: AllocatorClone>(
        mut self,
        key: K,
        val: V,
        edge: Root<K, V>,
        alloc: A,
    ) -> Option<SplitResult<'a, K, V, marker::Internal>> {
        assert!(edge.height == self.node.height - 1);

        if self.node.len() < CAPACITY {
            self.insert_fit(key, val, edge);
            None
        } else {
            let (middle_kv_idx, insertion) = splitpoint(self.idx);
            // ignore-tidy-undocumented-unsafe
            let middle = unsafe { Handle::new_kv(self.node, middle_kv_idx) };
            let mut result = middle.split(alloc);
            let mut insertion_edge = match insertion {
                // ignore-tidy-undocumented-unsafe
                LeftOrRight::Left(insert_idx) => unsafe {
                    Handle::new_edge(result.left.reborrow_mut(), insert_idx)
                },
                // ignore-tidy-undocumented-unsafe
                LeftOrRight::Right(insert_idx) => unsafe {
                    Handle::new_edge(result.right.borrow_mut(), insert_idx)
                },
            };
            insertion_edge.insert_fit(key, val, edge);
            Some(result)
        }
    }
}

impl<'a, K: 'a, V: 'a> Handle<NodeRef<marker::Mut<'a>, K, V, marker::Leaf>, marker::Edge> {
    /// 在右侧和左侧的键值对之间插入一个新的键值对。
    /// 此边。如果空间不足，该方法会分割节点，并尝试递归地将拆分部分放入父节点中，直到到达根节点。
    /// insert the split off portion into the parent node recursively, until the root is reached.
    ///
    /// If the returned result is some `SplitResult`, the `left` field will be the root node.
    /// The returned pointer points to the inserted value, which in the case of `SplitResult`
    /// is in the `left` or `right` tree.
    pub(super) fn insert_recursing<A: AllocatorClone>(
        self,
        key: K,
        value: V,
        alloc: A,
        split_root: impl FnOnce(SplitResult<'a, K, V, marker::LeafOrInternal>),
    ) -> Handle<NodeRef<marker::Mut<'a>, K, V, marker::Leaf>, marker::KV> {
        let (mut split, handle) = match self.insert(key, value, alloc.clone()) {
            // SAFETY: we have finished splitting and can now re-awaken the
            // handle to the inserted element.
            (None, handle) => return unsafe { handle.awaken() },
            (Some(split), handle) => (split.forget_node_type(), handle),
        };

        loop {
            split = match split.left.ascend() {
                Ok(parent) => {
                    match parent.insert(split.kv.0, split.kv.1, split.right, alloc.clone()) {
                        // SAFETY: we have finished splitting and can now re-awaken the
                        // handle to the inserted element.
                        None => return unsafe { handle.awaken() },
                        Some(split) => split.forget_node_type(),
                    }
                }
                Err(root) => {
                    split_root(SplitResult { left: root, ..split });
                    // SAFETY: we have finished splitting and can now re-awaken the
                    // handle to the inserted element.
                    return unsafe { handle.awaken() };
                }
            };
        }
    }
}

impl<BorrowType: marker::BorrowType, K, V>
    Handle<NodeRef<BorrowType, K, V, marker::Internal>, marker::Edge>
{
    /// 查找由此边指向的节点。
    ///
    /// 方法名称假设您将树想象为以根节点在顶部的结构。
    ///
    /// `edge.descend().ascend().unwrap()` and `node.ascend().unwrap().descend()` should
    /// 替换 KV 句柄所引用的键值对。
    pub(super) fn descend(self) -> NodeRef<BorrowType, K, V, marker::LeafOrInternal> {
        const {
            assert!(BorrowType::TRAVERSAL_PERMIT);
        }

        // We need to use raw pointers to nodes because, if BorrowType is
        // marker::ValMut, there might be outstanding mutable references to
        // values that we must not invalidate. There's no worry accessing the
        // height field because that value is copied. Beware that, once the
        // node pointer is dereferenced, we access the edges array with a
        // reference (Rust issue #73987) and invalidate any other references
        // to or inside the array, should any be around.
        let parent_ptr = NodeRef::as_internal_ptr(&self.node);
        // ignore-tidy-undocumented-unsafe
        let node = unsafe { (*parent_ptr).edges.get_unchecked(self.idx).assume_init_read() };
        NodeRef { node, height: self.node.height - 1, _marker: PhantomData }
    }
}

impl<'a, K: 'a, V: 'a, NodeType> Handle<NodeRef<marker::Immut<'a>, K, V, NodeType>, marker::KV> {
    pub(super) fn into_kv(self) -> (&'a K, &'a V) {
        debug_assert!(self.idx < self.node.len());
        let leaf = self.node.into_leaf();
        // ignore-tidy-undocumented-unsafe
        let k = unsafe { leaf.keys.get_unchecked(self.idx).assume_init_ref() };
        // ignore-tidy-undocumented-unsafe
        let v = unsafe { leaf.vals.get_unchecked(self.idx).assume_init_ref() };
        (k, v)
    }
}

impl<'a, K: 'a, V: 'a, NodeType> Handle<NodeRef<marker::Mut<'a>, K, V, NodeType>, marker::KV> {
    pub(super) fn key_mut(&mut self) -> &mut K {
        // ignore-tidy-undocumented-unsafe
        unsafe { self.node.key_area_mut(self.idx).assume_init_mut() }
    }

    pub(super) fn into_val_mut(self) -> &'a mut V {
        debug_assert!(self.idx < self.node.len());
        let leaf = self.node.into_leaf_mut();
        // ignore-tidy-undocumented-unsafe
        unsafe { leaf.vals.get_unchecked_mut(self.idx).assume_init_mut() }
    }

    pub(super) fn into_kv_mut(self) -> (&'a mut K, &'a mut V) {
        debug_assert!(self.idx < self.node.len());
        let leaf = self.node.into_leaf_mut();
        // ignore-tidy-undocumented-unsafe
        let k = unsafe { leaf.keys.get_unchecked_mut(self.idx).assume_init_mut() };
        // ignore-tidy-undocumented-unsafe
        let v = unsafe { leaf.vals.get_unchecked_mut(self.idx).assume_init_mut() };
        (k, v)
    }
}

impl<'a, K, V, NodeType> Handle<NodeRef<marker::ValMut<'a>, K, V, NodeType>, marker::KV> {
    pub(super) fn into_kv_valmut(self) -> (&'a K, &'a mut V) {
        // ignore-tidy-undocumented-unsafe
        unsafe { self.node.into_key_val_mut_at(self.idx) }
    }
}

impl<'a, K: 'a, V: 'a, NodeType> Handle<NodeRef<marker::Mut<'a>, K, V, NodeType>, marker::KV> {
    pub(super) fn kv_mut(&mut self) -> (&mut K, &mut V) {
        debug_assert!(self.idx < self.node.len());
        // We cannot call separate key and value methods, because calling the second one
        // invalidates the reference returned by the first.
        // ignore-tidy-undocumented-unsafe
        unsafe {
            let leaf = self.node.as_leaf_mut();
            let key = leaf.keys.get_unchecked_mut(self.idx).assume_init_mut();
            let val = leaf.vals.get_unchecked_mut(self.idx).assume_init_mut();
            (key, val)
        }
    }

    /// 提取 KV 句柄所引用的键值对。
    pub(super) fn replace_kv(&mut self, k: K, v: V) -> (K, V) {
        let (key, val) = self.kv_mut();
        (mem::replace(key, k), mem::replace(val, v))
    }
}

impl<K, V, NodeType> Handle<NodeRef<marker::Dying, K, V, NodeType>, marker::KV> {
    /// 提取 KV 句柄所引用的键值对。
    /// # 安全性
    /// 句柄所引用的节点尚未被释放。
    pub(super) unsafe fn into_key_val(mut self) -> (K, V) {
        debug_assert!(self.idx < self.node.len());
        let leaf = self.node.as_leaf_dying();
        // ignore-tidy-undocumented-unsafe
        unsafe {
            let key = leaf.keys.get_unchecked_mut(self.idx).assume_init_read();
            let val = leaf.vals.get_unchecked_mut(self.idx).assume_init_read();
            (key, val)
        }
    }

    /// 丢弃 KV 句柄所引用的键值对。
    /// # 安全性
    /// 句柄所引用的节点尚未被释放。
    #[inline]
    pub(super) unsafe fn drop_key_val(mut self) {
        // Run the destructor of the value even if the destructor of the key panics.
        struct Dropper<'a, T>(&'a mut MaybeUninit<T>);
        impl<T> Drop for Dropper<'_, T> {
            #[inline]
            fn drop(&mut self) {
                // ignore-tidy-undocumented-unsafe
                unsafe {
                    self.0.assume_init_drop();
                }
            }
        }

        debug_assert!(self.idx < self.node.len());
        let leaf = self.node.as_leaf_dying();
        // ignore-tidy-undocumented-unsafe
        unsafe {
            let key = leaf.keys.get_unchecked_mut(self.idx);
            let val = leaf.vals.get_unchecked_mut(self.idx);
            let _guard = Dropper(val);
            key.assume_init_drop();
            // dropping the guard will drop the value
        }
    }
}

impl<'a, K: 'a, V: 'a, NodeType> Handle<NodeRef<marker::Mut<'a>, K, V, NodeType>, marker::KV> {
    /// Helps implementations of `split` for a particular `NodeType`,
    /// 将叶节点数据纳入考虑。
    fn split_leaf_data(&mut self, new_node: &mut LeafNode<K, V>) -> (K, V) {
        debug_assert!(self.idx < self.node.len());
        let old_len = self.node.len();
        let new_len = old_len - self.idx - 1;
        new_node.len = new_len as u16;
        // ignore-tidy-undocumented-unsafe
        unsafe {
            let k = self.node.key_area_mut(self.idx).assume_init_read();
            let v = self.node.val_area_mut(self.idx).assume_init_read();

            move_to_slice(
                self.node.key_area_mut(self.idx + 1..old_len),
                &mut new_node.keys[..new_len],
            );
            move_to_slice(
                self.node.val_area_mut(self.idx + 1..old_len),
                &mut new_node.vals[..new_len],
            );

            *self.node.len_mut() = self.idx as u16;
            (k, v)
        }
    }
}

impl<'a, K: 'a, V: 'a> Handle<NodeRef<marker::Mut<'a>, K, V, marker::Leaf>, marker::KV> {
    /// 将底层节点分割为三个部分：
    ///
    /// - 节点仅包含此句柄左侧的键值对。
    /// 。
    /// - 提取此句柄所指向的键值对。
    /// - 将此句柄右侧的所有键值对放入新分配的节点中。
    /// 。
    pub(super) fn split<A: AllocatorClone>(
        mut self,
        alloc: A,
    ) -> SplitResult<'a, K, V, marker::Leaf> {
        let mut new_node = LeafNode::new(alloc);

        let kv = self.split_leaf_data(&mut new_node);

        let right = NodeRef::from_new_leaf(new_node);
        SplitResult { left: self.node, kv, right }
    }

    /// 移除此句柄所指向的键值对，并返回它以及该键值对折叠成的边。
    /// 将底层节点分割为三个部分：
    pub(super) fn remove(
        mut self,
    ) -> ((K, V), Handle<NodeRef<marker::Mut<'a>, K, V, marker::Leaf>, marker::Edge>) {
        let old_len = self.node.len();
        // ignore-tidy-undocumented-unsafe
        unsafe {
            let k = slice_remove(self.node.key_area_mut(..old_len), self.idx);
            let v = slice_remove(self.node.val_area_mut(..old_len), self.idx);
            *self.node.len_mut() = (old_len - 1) as u16;
            ((k, v), self.left_edge())
        }
    }
}

impl<'a, K: 'a, V: 'a> Handle<NodeRef<marker::Mut<'a>, K, V, marker::Internal>, marker::KV> {
    /// - 节点仅包含此句柄左侧的边和键值对。
    ///
    /// 。
    /// - 提取此句柄所指向的键值对。
    /// - 提取此句柄所指向的键值对。
    /// - 将此句柄右侧的所有边和键值对放入新分配的节点中。
    /// 。
    pub(super) fn split<A: AllocatorClone>(
        mut self,
        alloc: A,
    ) -> SplitResult<'a, K, V, marker::Internal> {
        let old_len = self.node.len();
        // ignore-tidy-undocumented-unsafe
        unsafe {
            let mut new_node = InternalNode::new(alloc);
            let kv = self.split_leaf_data(&mut new_node.data);
            let new_len = usize::from(new_node.data.len);
            move_to_slice(
                self.node.edge_area_mut(self.idx + 1..old_len + 1),
                &mut new_node.edges[..new_len + 1],
            );

            // SAFETY: self is `marker::Internal`, so `self.node.height` is positive
            let height = NonZero::new_unchecked(self.node.height);
            let right = NodeRef::from_new_internal(new_node, height);

            SplitResult { left: self.node, kv, right }
        }
    }
}

/// 表示用于评估和执行平衡操作的会话，围绕内部键值对。
/// 选择以节点为子节点的平衡上下文，即位于父节点中紧接左侧或右侧的 KV。
pub(super) struct BalancingContext<'a, K, V> {
    parent: Handle<NodeRef<marker::Mut<'a>, K, V, marker::Internal>, marker::KV>,
    left_child: NodeRef<marker::Mut<'a>, K, V, marker::LeafOrInternal>,
    right_child: NodeRef<marker::Mut<'a>, K, V, marker::LeafOrInternal>,
}

impl<'a, K, V> Handle<NodeRef<marker::Mut<'a>, K, V, marker::Internal>, marker::KV> {
    pub(super) fn consider_for_balancing(self) -> BalancingContext<'a, K, V> {
        // ignore-tidy-undocumented-unsafe
        let self1 = unsafe { ptr::read(&self) };
        // ignore-tidy-undocumented-unsafe
        let self2 = unsafe { ptr::read(&self) };
        BalancingContext {
            parent: self,
            left_child: self1.left_edge().descend(),
            right_child: self2.right_edge().descend(),
        }
    }
}

impl<'a, K, V> NodeRef<marker::Mut<'a>, K, V, marker::LeafOrInternal> {
    /// Chooses a balancing context involving the node as a child, thus between
    /// 如果父节点为空，则发生 panic。
    /// Returns an `Err` if there is no parent.
    /// Panics if the parent is empty.
    ///
    /// Prefers the left side, to be optimal if the given node is somehow
    /// underfull, meaning here only that it has fewer elements than its left
    /// 与其右侧兄弟节点（如果存在的话），进行合并。在这种情况下，
    /// 与左侧兄弟节点合并更快，因为我们只需移动
    /// 节点的 N 个元素，而不是将它们向右移动并增加
    /// 超过 N 个元素。从左侧兄弟节点窃取元素同样
    /// 通常更快，因为我们只需将节点的 N 个元素移动到
    /// 右侧，而不是至少将兄弟节点的 N 个元素移动到
    /// 左侧。
    pub(super) fn choose_parent_kv(self) -> Result<LeftOrRight<BalancingContext<'a, K, V>>, Self> {
        // ignore-tidy-undocumented-unsafe
        match unsafe { ptr::read(&self) }.ascend() {
            Ok(parent_edge) => match parent_edge.left_kv() {
                Ok(left_parent_kv) => Ok(LeftOrRight::Left(BalancingContext {
                    // ignore-tidy-undocumented-unsafe
                    parent: unsafe { ptr::read(&left_parent_kv) },
                    left_child: left_parent_kv.left_edge().descend(),
                    right_child: self,
                })),
                Err(parent_edge) => match parent_edge.right_kv() {
                    Ok(right_parent_kv) => Ok(LeftOrRight::Right(BalancingContext {
                        // ignore-tidy-undocumented-unsafe
                        parent: unsafe { ptr::read(&right_parent_kv) },
                        left_child: self,
                        right_child: right_parent_kv.right_edge().descend(),
                    })),
                    Err(_) => unreachable!("empty internal node"),
                },
            },
            Err(root) => Err(root),
        }
    }
}

impl<'a, K, V> BalancingContext<'a, K, V> {
    pub(super) fn left_child_len(&self) -> usize {
        self.left_child.len()
    }

    pub(super) fn right_child_len(&self) -> usize {
        self.right_child.len()
    }

    pub(super) fn into_left_child(self) -> NodeRef<marker::Mut<'a>, K, V, marker::LeafOrInternal> {
        self.left_child
    }

    pub(super) fn into_right_child(self) -> NodeRef<marker::Mut<'a>, K, V, marker::LeafOrInternal> {
        self.right_child
    }

    /// 返回是否可以进行合并，即节点中是否有足够的空间
    /// 将中心 KV 与两个相邻子节点结合。
    pub(super) fn can_merge(&self) -> bool {
        self.left_child.len() + 1 + self.right_child.len() <= CAPACITY
    }
}

impl<'a, K: 'a, V: 'a> BalancingContext<'a, K, V> {
    /// 执行合并操作，并让闭包决定返回什么。
    fn do_merge<
        F: FnOnce(
            NodeRef<marker::Mut<'a>, K, V, marker::Internal>,
            NodeRef<marker::Mut<'a>, K, V, marker::LeafOrInternal>,
        ) -> R,
        R,
        A: Allocator,
    >(
        self,
        result: F,
        alloc: A,
    ) -> R {
        let Handle { node: mut parent_node, idx: parent_idx, _marker } = self.parent;
        let old_parent_len = parent_node.len();
        let mut left_node = self.left_child;
        let old_left_len = left_node.len();
        let mut right_node = self.right_child;
        let right_len = right_node.len();
        let new_left_len = old_left_len + 1 + right_len;

        assert!(new_left_len <= CAPACITY);

        // ignore-tidy-undocumented-unsafe
        unsafe {
            *left_node.len_mut() = new_left_len as u16;

            let parent_key = slice_remove(parent_node.key_area_mut(..old_parent_len), parent_idx);
            left_node.key_area_mut(old_left_len).write(parent_key);
            move_to_slice(
                right_node.key_area_mut(..right_len),
                left_node.key_area_mut(old_left_len + 1..new_left_len),
            );

            let parent_val = slice_remove(parent_node.val_area_mut(..old_parent_len), parent_idx);
            left_node.val_area_mut(old_left_len).write(parent_val);
            move_to_slice(
                right_node.val_area_mut(..right_len),
                left_node.val_area_mut(old_left_len + 1..new_left_len),
            );

            slice_remove(parent_node.edge_area_mut(..old_parent_len + 1), parent_idx + 1);
            parent_node.correct_childrens_parent_links(parent_idx + 1..old_parent_len);
            *parent_node.len_mut() -= 1;

            if parent_node.height > 1 {
                // SAFETY: the height of the nodes being merged is one below the height
                // of the node of this edge, thus above zero, so they are internal.
                let mut left_node = left_node.reborrow_mut().cast_to_internal_unchecked();
                let mut right_node = right_node.cast_to_internal_unchecked();
                move_to_slice(
                    right_node.edge_area_mut(..right_len + 1),
                    left_node.edge_area_mut(old_left_len + 1..new_left_len + 1),
                );

                left_node.correct_childrens_parent_links(old_left_len + 1..new_left_len + 1);

                alloc.deallocate(right_node.node.cast(), Layout::new::<InternalNode<K, V>>());
            } else {
                alloc.deallocate(right_node.node.cast(), Layout::new::<LeafNode<K, V>>());
            }
        }
        result(parent_node, left_node)
    }

    /// 将父节点的键值对与两个相邻子节点合并到
    /// 左侧子节点中，并返回缩小的父节点。
    ///
    /// Panics unless we `.can_merge()`.
    pub(super) fn merge_tracking_parent<A: AllocatorClone>(
        self,
        alloc: A,
    ) -> NodeRef<marker::Mut<'a>, K, V, marker::Internal> {
        self.do_merge(|parent, _child| parent, alloc)
    }

    /// 将父节点的键值对与两个相邻子节点合并到
    /// 左侧子节点中，并返回该子节点。
    ///
    /// Panics unless we `.can_merge()`.
    pub(super) fn merge_tracking_child<A: AllocatorClone>(
        self,
        alloc: A,
    ) -> NodeRef<marker::Mut<'a>, K, V, marker::LeafOrInternal> {
        self.do_merge(|_parent, child| child, alloc)
    }

    /// 将父节点的键值对与两个相邻子节点合并到
    /// 左侧子节点中，并返回该子节点中的边缘句柄
    /// 即被跟踪的子边缘结束的位置。
    ///
    /// Panics unless we `.can_merge()`.
    pub(super) fn merge_tracking_child_edge<A: AllocatorClone>(
        self,
        track_edge_idx: LeftOrRight<usize>,
        alloc: A,
    ) -> Handle<NodeRef<marker::Mut<'a>, K, V, marker::LeafOrInternal>, marker::Edge> {
        let old_left_len = self.left_child.len();
        let right_len = self.right_child.len();
        assert!(match track_edge_idx {
            LeftOrRight::Left(idx) => idx <= old_left_len,
            LeftOrRight::Right(idx) => idx <= right_len,
        });
        let child = self.merge_tracking_child(alloc);
        let new_idx = match track_edge_idx {
            LeftOrRight::Left(idx) => idx,
            LeftOrRight::Right(idx) => old_left_len + 1 + idx,
        };
        // ignore-tidy-undocumented-unsafe
        unsafe { Handle::new_edge(child, new_idx) }
    }

    /// 从左侧子节点移除一个键值对并将其放入父节点的键值存储中，
    /// 同时将旧的父节点键值对推入右侧子节点。
    /// Returns a handle to the edge in the right child corresponding to where the original
    /// edge specified by `track_right_edge_idx` ended up.
    pub(super) fn steal_left(
        mut self,
        track_right_edge_idx: usize,
    ) -> Handle<NodeRef<marker::Mut<'a>, K, V, marker::LeafOrInternal>, marker::Edge> {
        self.bulk_steal_left(1);
        // ignore-tidy-undocumented-unsafe
        unsafe { Handle::new_edge(self.right_child, 1 + track_right_edge_idx) }
    }

    /// 同时将旧的父节点键值对推入左侧子节点。
    /// of the parent, while pushing the old parent key-value pair onto the left child.
    /// Returns a handle to the edge in the left child specified by `track_left_edge_idx`,
    /// which didn't move.
    pub(super) fn steal_right(
        mut self,
        track_left_edge_idx: usize,
    ) -> Handle<NodeRef<marker::Mut<'a>, K, V, marker::LeafOrInternal>, marker::Edge> {
        self.bulk_steal_right(1);
        // ignore-tidy-undocumented-unsafe
        unsafe { Handle::new_edge(self.left_child, track_left_edge_idx) }
    }

    /// This does stealing similar to `steal_left` but steals multiple elements at once.
    pub(super) fn bulk_steal_left(&mut self, count: usize) {
        assert!(count > 0);
        // ignore-tidy-undocumented-unsafe
        unsafe {
            let left_node = &mut self.left_child;
            let old_left_len = left_node.len();
            let right_node = &mut self.right_child;
            let old_right_len = right_node.len();

            // Make sure that we may steal safely.
            assert!(old_right_len + count <= CAPACITY);
            assert!(old_left_len >= count);

            let new_left_len = old_left_len - count;
            let new_right_len = old_right_len + count;
            *left_node.len_mut() = new_left_len as u16;
            *right_node.len_mut() = new_right_len as u16;

            // Move leaf data.
            {
                // Make room for stolen elements in the right child.
                slice_shr(right_node.key_area_mut(..new_right_len), count);
                slice_shr(right_node.val_area_mut(..new_right_len), count);

                // Move elements from the left child to the right one.
                move_to_slice(
                    left_node.key_area_mut(new_left_len + 1..old_left_len),
                    right_node.key_area_mut(..count - 1),
                );
                move_to_slice(
                    left_node.val_area_mut(new_left_len + 1..old_left_len),
                    right_node.val_area_mut(..count - 1),
                );

                // Move the leftmost stolen pair to the parent.
                let k = left_node.key_area_mut(new_left_len).assume_init_read();
                let v = left_node.val_area_mut(new_left_len).assume_init_read();
                let (k, v) = self.parent.replace_kv(k, v);

                // Move parent's key-value pair to the right child.
                right_node.key_area_mut(count - 1).write(k);
                right_node.val_area_mut(count - 1).write(v);
            }

            match (left_node.reborrow_mut().force(), right_node.reborrow_mut().force()) {
                (ForceResult::Internal(mut left), ForceResult::Internal(mut right)) => {
                    // Make room for stolen edges.
                    slice_shr(right.edge_area_mut(..new_right_len + 1), count);

                    // Steal edges.
                    move_to_slice(
                        left.edge_area_mut(new_left_len + 1..old_left_len + 1),
                        right.edge_area_mut(..count),
                    );

                    right.correct_childrens_parent_links(0..new_right_len + 1);
                }
                (ForceResult::Leaf(_), ForceResult::Leaf(_)) => {}
                _ => unreachable!(),
            }
        }
    }

    /// The symmetric clone of `bulk_steal_left`.
    pub(super) fn bulk_steal_right(&mut self, count: usize) {
        assert!(count > 0);
        // ignore-tidy-undocumented-unsafe
        unsafe {
            let left_node = &mut self.left_child;
            let old_left_len = left_node.len();
            let right_node = &mut self.right_child;
            let old_right_len = right_node.len();

            // Make sure that we may steal safely.
            assert!(old_left_len + count <= CAPACITY);
            assert!(old_right_len >= count);

            let new_left_len = old_left_len + count;
            let new_right_len = old_right_len - count;
            *left_node.len_mut() = new_left_len as u16;
            *right_node.len_mut() = new_right_len as u16;

            // Move leaf data.
            {
                // Move the rightmost stolen pair to the parent.
                let k = right_node.key_area_mut(count - 1).assume_init_read();
                let v = right_node.val_area_mut(count - 1).assume_init_read();
                let (k, v) = self.parent.replace_kv(k, v);

                // Move parent's key-value pair to the left child.
                left_node.key_area_mut(old_left_len).write(k);
                left_node.val_area_mut(old_left_len).write(v);

                // Move elements from the right child to the left one.
                move_to_slice(
                    right_node.key_area_mut(..count - 1),
                    left_node.key_area_mut(old_left_len + 1..new_left_len),
                );
                move_to_slice(
                    right_node.val_area_mut(..count - 1),
                    left_node.val_area_mut(old_left_len + 1..new_left_len),
                );

                // Fill gap where stolen elements used to be.
                slice_shl(right_node.key_area_mut(..old_right_len), count);
                slice_shl(right_node.val_area_mut(..old_right_len), count);
            }

            match (left_node.reborrow_mut().force(), right_node.reborrow_mut().force()) {
                (ForceResult::Internal(mut left), ForceResult::Internal(mut right)) => {
                    // Steal edges.
                    move_to_slice(
                        right.edge_area_mut(..count),
                        left.edge_area_mut(old_left_len + 1..new_left_len + 1),
                    );

                    // Fill gap where stolen edges used to be.
                    slice_shl(right.edge_area_mut(..old_right_len + 1), count);

                    left.correct_childrens_parent_links(old_left_len + 1..new_left_len + 1);
                    right.correct_childrens_parent_links(0..new_right_len + 1);
                }
                (ForceResult::Leaf(_), ForceResult::Leaf(_)) => {}
                _ => unreachable!(),
            }
        }
    }
}

impl<BorrowType, K, V> Handle<NodeRef<BorrowType, K, V, marker::Leaf>, marker::Edge> {
    pub(super) fn forget_node_type(
        self,
    ) -> Handle<NodeRef<BorrowType, K, V, marker::LeafOrInternal>, marker::Edge> {
        // ignore-tidy-undocumented-unsafe
        unsafe { Handle::new_edge(self.node.forget_type(), self.idx) }
    }
}

impl<BorrowType, K, V> Handle<NodeRef<BorrowType, K, V, marker::Internal>, marker::Edge> {
    pub(super) fn forget_node_type(
        self,
    ) -> Handle<NodeRef<BorrowType, K, V, marker::LeafOrInternal>, marker::Edge> {
        // ignore-tidy-undocumented-unsafe
        unsafe { Handle::new_edge(self.node.forget_type(), self.idx) }
    }
}

impl<BorrowType, K, V> Handle<NodeRef<BorrowType, K, V, marker::Leaf>, marker::KV> {
    pub(super) fn forget_node_type(
        self,
    ) -> Handle<NodeRef<BorrowType, K, V, marker::LeafOrInternal>, marker::KV> {
        // ignore-tidy-undocumented-unsafe
        unsafe { Handle::new_kv(self.node.forget_type(), self.idx) }
    }
}

impl<BorrowType, K, V, Type> Handle<NodeRef<BorrowType, K, V, marker::LeafOrInternal>, Type> {
    /// Checks whether the underlying node is an `Internal` node or a `Leaf` node.
    pub(super) fn force(
        self,
    ) -> ForceResult<
        Handle<NodeRef<BorrowType, K, V, marker::Leaf>, Type>,
        Handle<NodeRef<BorrowType, K, V, marker::Internal>, Type>,
    > {
        match self.node.force() {
            ForceResult::Leaf(node) => {
                ForceResult::Leaf(Handle { node, idx: self.idx, _marker: PhantomData })
            }
            ForceResult::Internal(node) => {
                ForceResult::Internal(Handle { node, idx: self.idx, _marker: PhantomData })
            }
        }
    }
}

impl<'a, K, V, Type> Handle<NodeRef<marker::Mut<'a>, K, V, marker::LeafOrInternal>, Type> {
    /// Unsafely asserts to the compiler the static information that the handle's node is a `Leaf`.
    pub(super) unsafe fn cast_to_leaf_unchecked(
        self,
    ) -> Handle<NodeRef<marker::Mut<'a>, K, V, marker::Leaf>, Type> {
        // ignore-tidy-undocumented-unsafe
        let node = unsafe { self.node.cast_to_leaf_unchecked() };
        Handle { node, idx: self.idx, _marker: PhantomData }
    }
}

impl<'a, K, V> Handle<NodeRef<marker::Mut<'a>, K, V, marker::LeafOrInternal>, marker::Edge> {
    /// Move the suffix after `self` from one node to another one. `right` must be empty.
    /// The first edge of `right` remains unchanged.
    pub(super) fn move_suffix(
        &mut self,
        right: &mut NodeRef<marker::Mut<'a>, K, V, marker::LeafOrInternal>,
    ) {
        // ignore-tidy-undocumented-unsafe
        unsafe {
            let new_left_len = self.idx;
            let mut left_node = self.reborrow_mut().into_node();
            let old_left_len = left_node.len();

            let new_right_len = old_left_len - new_left_len;
            let mut right_node = right.reborrow_mut();

            assert!(right_node.len() == 0);
            assert!(left_node.height == right_node.height);

            if new_right_len > 0 {
                *left_node.len_mut() = new_left_len as u16;
                *right_node.len_mut() = new_right_len as u16;

                move_to_slice(
                    left_node.key_area_mut(new_left_len..old_left_len),
                    right_node.key_area_mut(..new_right_len),
                );
                move_to_slice(
                    left_node.val_area_mut(new_left_len..old_left_len),
                    right_node.val_area_mut(..new_right_len),
                );
                match (left_node.force(), right_node.force()) {
                    (ForceResult::Internal(mut left), ForceResult::Internal(mut right)) => {
                        move_to_slice(
                            left.edge_area_mut(new_left_len + 1..old_left_len + 1),
                            right.edge_area_mut(1..new_right_len + 1),
                        );
                        right.correct_childrens_parent_links(1..new_right_len + 1);
                    }
                    (ForceResult::Leaf(_), ForceResult::Leaf(_)) => {}
                    _ => unreachable!(),
                }
            }
        }
    }
}

pub(super) enum ForceResult<Leaf, Internal> {
    Leaf(Leaf),
    Internal(Internal),
}

/// 当节点需要扩展超过其容量时的插入结果。
pub(super) struct SplitResult<'a, K, V, NodeType> {
    // Altered node in existing tree with elements and edges that belong to the left of `kv`.
    pub left: NodeRef<marker::Mut<'a>, K, V, NodeType>,
    // Some key and value that existed before and were split off, to be inserted elsewhere.
    pub kv: (K, V),
    // Owned, unattached, new node with elements and edges that belong to the right of `kv`.
    pub right: NodeRef<marker::Owned, K, V, NodeType>,
}

impl<'a, K, V> SplitResult<'a, K, V, marker::Leaf> {
    pub(super) fn forget_node_type(self) -> SplitResult<'a, K, V, marker::LeafOrInternal> {
        SplitResult { left: self.left.forget_type(), kv: self.kv, right: self.right.forget_type() }
    }
}

impl<'a, K, V> SplitResult<'a, K, V, marker::Internal> {
    pub(super) fn forget_node_type(self) -> SplitResult<'a, K, V, marker::LeafOrInternal> {
        SplitResult { left: self.left.forget_type(), kv: self.kv, right: self.right.forget_type() }
    }
}

pub(super) mod marker {
    use core::marker::PhantomData;

    pub(crate) enum Leaf {}
    pub(crate) enum Internal {}
    pub(crate) enum LeafOrInternal {}

    pub(crate) enum Owned {}
    pub(crate) enum Dying {}
    pub(crate) enum DormantMut {}
    pub(crate) struct Immut<'a>(PhantomData<&'a ()>);
    pub(crate) struct Mut<'a>(PhantomData<&'a mut ()>);
    pub(crate) struct ValMut<'a>(PhantomData<&'a mut ()>);

    pub(crate) trait BorrowType {
        /// 如果此借用类型的节点可以遍历到树中的其他
        /// nodes in the tree, this constant is set to `true`. It can be used
        /// 用于编译时断言。
        const TRAVERSAL_PERMIT: bool = true;
    }
    impl BorrowType for Owned {
        /// Reject traversal, because it isn't needed. Instead traversal
        /// happens using the result of `borrow_mut`.
        /// 通过禁用遍历，并仅创建对根节点的新引用，
        /// we know that every reference of the `Owned` type is to a root node.
        const TRAVERSAL_PERMIT: bool = false;
    }
    impl BorrowType for Dying {}
    impl<'a> BorrowType for Immut<'a> {}
    impl<'a> BorrowType for Mut<'a> {}
    impl<'a> BorrowType for ValMut<'a> {}
    impl BorrowType for DormantMut {}

    pub(crate) enum KV {}
    pub(crate) enum Edge {}
}

/// 将值插入到一个已初始化元素的切片中，随后添加一个未初始化的元素。
///
/// # 安全性
/// The slice has more than `idx` elements.
unsafe fn slice_insert<T>(slice: &mut [MaybeUninit<T>], idx: usize, val: T) {
    let len = slice.len();
    debug_assert!(len > idx);
    let slice_ptr = slice.as_mut_ptr();
    // ignore-tidy-undocumented-unsafe
    unsafe {
        if len > idx + 1 {
            ptr::copy(slice_ptr.add(idx), slice_ptr.add(idx + 1), len - idx - 1);
        }
        (*slice_ptr.add(idx)).write(val);
    }
}

/// 从所有已初始化元素的切片中移除并返回一个值，留下一个
/// 未初始化的尾随元素。
///
/// # 安全性
/// The slice has more than `idx` elements.
unsafe fn slice_remove<T>(slice: &mut [MaybeUninit<T>], idx: usize) -> T {
    let len = slice.len();
    debug_assert!(idx < len);
    let slice_ptr = slice.as_mut_ptr();
    // ignore-tidy-undocumented-unsafe
    unsafe {
        let ret = (*slice_ptr.add(idx)).assume_init_read();
        ptr::copy(slice_ptr.add(idx + 1), slice_ptr.add(idx), len - idx - 1);
        ret
    }
}

/// Shifts the elements in a slice `distance` positions to the left.
///
/// # 安全性
/// The slice has at least `distance` elements.
unsafe fn slice_shl<T>(slice: &mut [MaybeUninit<T>], distance: usize) {
    let slice_ptr = slice.as_mut_ptr();
    // ignore-tidy-undocumented-unsafe
    unsafe {
        ptr::copy(slice_ptr.add(distance), slice_ptr, slice.len() - distance);
    }
}

/// Shifts the elements in a slice `distance` positions to the right.
///
/// # 安全性
/// The slice has at least `distance` elements.
unsafe fn slice_shr<T>(slice: &mut [MaybeUninit<T>], distance: usize) {
    let slice_ptr = slice.as_mut_ptr();
    // ignore-tidy-undocumented-unsafe
    unsafe {
        ptr::copy(slice_ptr, slice_ptr.add(distance), slice.len() - distance);
    }
}

/// Moves all values from a slice of initialized elements to a slice
/// of uninitialized elements, leaving behind `src` as all uninitialized.
/// Works like `dst.copy_from_slice(src)` but does not require `T` to be `Copy`.
fn move_to_slice<T>(src: &mut [MaybeUninit<T>], dst: &mut [MaybeUninit<T>]) {
    assert!(src.len() == dst.len());
    // ignore-tidy-undocumented-unsafe
    unsafe {
        ptr::copy_nonoverlapping(src.as_ptr(), dst.as_mut_ptr(), src.len());
    }
}

#[cfg(test)]
mod tests;
