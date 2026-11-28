use core::fmt::{self, Debug};
use core::marker::PhantomData;
use core::mem;

use Entry::*;

use super::super::borrow::DormantMutRef;
use super::super::node::{Handle, NodeRef, marker};
use super::BTreeMap;
use crate::alloc::{AllocatorClone, Global};

/// 对映射中单个条目的查看，该条目可能是空的或被占用的。
///
/// This `enum` is constructed from the [`entry`] method on [`BTreeMap`].
///
/// [`entry`]: BTreeMap::entry
#[stable(feature = "rust1", since = "1.0.0")]
#[cfg_attr(not(test), rustc_diagnostic_item = "BTreeEntry")]
pub enum Entry<
    'a,
    K: 'a,
    V: 'a,
    #[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")] A: AllocatorClone = Global,
> {
    /// 一个空的条目。
    #[stable(feature = "rust1", since = "1.0.0")]
    Vacant(#[stable(feature = "rust1", since = "1.0.0")] VacantEntry<'a, K, V, A>),

    /// 一个被占用的条目。
    #[stable(feature = "rust1", since = "1.0.0")]
    Occupied(#[stable(feature = "rust1", since = "1.0.0")] OccupiedEntry<'a, K, V, A>),
}

#[stable(feature = "debug_btree_map", since = "1.12.0")]
impl<K: Debug + Ord, V: Debug, A: AllocatorClone> Debug for Entry<'_, K, V, A> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match *self {
            Vacant(ref v) => f.debug_tuple("Entry").field(v).finish(),
            Occupied(ref o) => f.debug_tuple("Entry").field(o).finish(),
        }
    }
}

/// A view into a vacant entry in a `BTreeMap`.
/// It is part of the [`Entry`] enum.
#[stable(feature = "rust1", since = "1.0.0")]
pub struct VacantEntry<
    'a,
    K,
    V,
    #[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")] A: AllocatorClone = Global,
> {
    pub(super) key: K,
    /// `None` for a (empty) map without root
    pub(super) handle: Option<Handle<NodeRef<marker::Mut<'a>, K, V, marker::Leaf>, marker::Edge>>,
    pub(super) dormant_map: DormantMutRef<'a, BTreeMap<K, V, A>>,

    /// The BTreeMap will outlive this IntoIter so we don't care about drop order for `alloc`.
    pub(super) alloc: A,

    // Be invariant in `K` and `V`
    pub(super) _marker: PhantomData<&'a mut (K, V)>,
}

#[stable(feature = "debug_btree_map", since = "1.12.0")]
impl<K: Debug + Ord, V, A: AllocatorClone> Debug for VacantEntry<'_, K, V, A> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_tuple("VacantEntry").field(self.key()).finish()
    }
}

/// A view into an occupied entry in a `BTreeMap`.
/// It is part of the [`Entry`] enum.
#[stable(feature = "rust1", since = "1.0.0")]
pub struct OccupiedEntry<
    'a,
    K,
    V,
    #[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")] A: AllocatorClone = Global,
> {
    pub(super) handle: Handle<NodeRef<marker::Mut<'a>, K, V, marker::LeafOrInternal>, marker::KV>,
    pub(super) dormant_map: DormantMutRef<'a, BTreeMap<K, V, A>>,

    /// The BTreeMap will outlive this IntoIter so we don't care about drop order for `alloc`.
    pub(super) alloc: A,

    // Be invariant in `K` and `V`
    pub(super) _marker: PhantomData<&'a mut (K, V)>,
}

#[stable(feature = "debug_btree_map", since = "1.12.0")]
impl<K: Debug + Ord, V: Debug, A: AllocatorClone> Debug for OccupiedEntry<'_, K, V, A> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("OccupiedEntry").field("key", self.key()).field("value", self.get()).finish()
    }
}

/// The error returned by [`try_insert`](BTreeMap::try_insert) when the key already exists.
///
/// 包含被占用的条目、键以及未插入的值。
#[unstable(feature = "map_try_insert", issue = "82766")]
#[non_exhaustive]
pub struct OccupiedError<
    'a,
    K: 'a,
    V: 'a,
    #[unstable(feature = "allocator_ext", issue = "163177", implied_by = "allocator_api")] A: AllocatorClone = Global,
> {
    /// 映射中已经被占用的条目。
    pub entry: OccupiedEntry<'a, K, V, A>,
    /// 未插入的键，因为条目已经被占用。
    pub key: K,
    /// 未插入的值，因为条目已经被占用。
    pub value: V,
}

#[unstable(feature = "map_try_insert", issue = "82766")]
impl<K: Debug + Ord, V: Debug, A: AllocatorClone> Debug for OccupiedError<'_, K, V, A> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("OccupiedError")
            .field("key", self.entry.key())
            .field("uninserted_key", &self.key)
            .field("old_value", self.entry.get())
            .field("new_value", &self.value)
            .finish()
    }
}

impl<'a, K: Ord, V, A: AllocatorClone> Entry<'a, K, V, A> {
    /// 通过如果为空则插入默认值来确保值存在于条目中，并返回
    /// 对条目中值的可修改引用。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::BTreeMap;
    ///
    /// let mut map: BTreeMap<&str, usize> = BTreeMap::new();
    /// map.entry("poneyland").or_insert(12);
    ///
    /// assert_eq!(map["poneyland"], 12);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn or_insert(self, default: V) -> &'a mut V {
        match self {
            Occupied(entry) => entry.into_mut(),
            Vacant(entry) => entry.insert(default),
        }
    }

    /// 通过如果为空则插入默认函数的结果来确保值存在于条目中，
    /// 并返回对条目中值的可修改引用。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::BTreeMap;
    ///
    /// let mut map: BTreeMap<&str, String> = BTreeMap::new();
    /// let s = "hoho".to_string();
    ///
    /// map.entry("poneyland").or_insert_with(|| s);
    ///
    /// assert_eq!(map["poneyland"], "hoho".to_string());
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn or_insert_with<F: FnOnce() -> V>(self, default: F) -> &'a mut V {
        self.or_try_insert_with(|| Result::<_, !>::Ok(default())).unwrap()
    }

    /// 通过如果为空则插入有错误的默认函数的结果来确保值存在于条目中，
    /// 并返回对条目中值的可修改引用。
    ///
    /// This method works identically to [`or_insert_with`] except that the default function
    /// should return a `Result` and, in the case of an error, the error is propagated.
    ///
    /// [`or_insert_with`]: Self::or_insert_with
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(try_entry)]
    /// # fn main() -> Result<(), std::num::ParseIntError> {
    /// use std::collections::BTreeMap;
    ///
    /// let mut map: BTreeMap<&str, usize> = BTreeMap::new();
    /// let value = "42";
    ///
    /// map.entry("poneyland").or_try_insert_with(|| value.parse())?;
    ///
    /// assert_eq!(map["poneyland"], 42);
    /// # Ok(())
    /// # }
    /// ```
    #[inline]
    #[unstable(feature = "try_entry", issue = "157354")]
    pub fn or_try_insert_with<F: FnOnce() -> Result<V, E>, E>(
        self,
        default: F,
    ) -> Result<&'a mut V, E> {
        match self {
            Occupied(entry) => Ok(entry.into_mut()),
            Vacant(entry) => Ok(entry.insert(default()?)),
        }
    }

    /// 通过如果为空则插入默认函数的结果来确保值存在于条目中。
    ///
    /// 此方法允许通过提供默认函数来生成用于插入的键派生值，
    /// function a reference to the key that was moved during the `.entry(key)` method call.
    ///
    /// 提供对被移动键的引用，以便克隆或复制键是
    /// unnecessary, unlike with `.or_insert_with(|| ... )`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::BTreeMap;
    ///
    /// let mut map: BTreeMap<&str, usize> = BTreeMap::new();
    ///
    /// map.entry("poneyland").or_insert_with_key(|key| key.chars().count());
    ///
    /// assert_eq!(map["poneyland"], 9);
    /// ```
    #[inline]
    #[stable(feature = "or_insert_with_key", since = "1.50.0")]
    pub fn or_insert_with_key<F: FnOnce(&K) -> V>(self, default: F) -> &'a mut V {
        self.or_try_insert_with_key(|k| Result::<_, !>::Ok(default(k))).into_ok()
    }

    /// 通过如果为空则插入默认函数的结果来确保值存在于条目中。
    /// 此方法允许通过提供默认函数来生成用于插入的键派生值，
    /// function a reference to the key that was moved during the `entry(key)` method call.
    ///
    /// This method works identically to [`or_insert_with_key`] except that the default function
    /// should return a `Result` and, in the case of an error, the error is propagated.
    ///
    /// [`or_insert_with_key`]: Self::or_insert_with_key
    ///
    /// # 示例
    ///
    /// ```
    /// #![feature(try_entry)]
    /// # fn main() -> Result<(), std::num::ParseIntError> {
    /// use std::collections::BTreeMap;
    ///
    /// let mut map: BTreeMap<&str, usize> = BTreeMap::new();
    ///
    /// map.entry("42").or_try_insert_with_key(|key| key.parse())?;
    ///
    /// assert_eq!(map["42"], 42);
    /// # Ok(())
    /// # }
    /// ```
    #[inline]
    #[unstable(feature = "try_entry", issue = "157354")]
    pub fn or_try_insert_with_key<F: FnOnce(&K) -> Result<V, E>, E>(
        self,
        default: F,
    ) -> Result<&'a mut V, E> {
        match self {
            Occupied(entry) => Ok(entry.into_mut()),
            Vacant(entry) => {
                let value = default(entry.key())?;
                Ok(entry.insert(value))
            }
        }
    }

    /// 返回对此条目键的引用。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::BTreeMap;
    ///
    /// let mut map: BTreeMap<&str, usize> = BTreeMap::new();
    /// assert_eq!(map.entry("poneyland").key(), &"poneyland");
    /// ```
    #[stable(feature = "map_entry_keys", since = "1.10.0")]
    pub fn key(&self) -> &K {
        match *self {
            Occupied(ref entry) => entry.key(),
            Vacant(ref entry) => entry.key(),
        }
    }

    /// 在可能向映射中插入内容之前，提供对已占用条目的可修改访问权。
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::BTreeMap;
    ///
    /// let mut map: BTreeMap<&str, usize> = BTreeMap::new();
    ///
    /// map.entry("poneyland")
    ///    .and_modify(|e| { *e += 1 })
    ///    .or_insert(42);
    /// assert_eq!(map["poneyland"], 42);
    ///
    /// map.entry("poneyland")
    ///    .and_modify(|e| { *e += 1 })
    ///    .or_insert(42);
    /// assert_eq!(map["poneyland"], 43);
    /// ```
    #[stable(feature = "entry_and_modify", since = "1.26.0")]
    pub fn and_modify<F>(self, f: F) -> Self
    where
        F: FnOnce(&mut V),
    {
        match self {
            Occupied(mut entry) => {
                f(entry.get_mut());
                Occupied(entry)
            }
            Vacant(entry) => Vacant(entry),
        }
    }

    /// Sets the value of the entry, and returns an `OccupiedEntry`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::BTreeMap;
    ///
    /// let mut map: BTreeMap<&str, String> = BTreeMap::new();
    /// let entry = map.entry("poneyland").insert_entry("hoho".to_string());
    ///
    /// assert_eq!(entry.key(), &"poneyland");
    /// assert_eq!(entry.get(), &"hoho");
    /// ```
    #[inline]
    #[stable(feature = "btree_entry_insert", since = "1.92.0")]
    pub fn insert_entry(self, value: V) -> OccupiedEntry<'a, K, V, A> {
        match self {
            Occupied(mut entry) => {
                entry.insert(value);
                entry
            }
            Vacant(entry) => entry.insert_entry(value),
        }
    }
}

impl<'a, K: Ord, V: Default, A: AllocatorClone> Entry<'a, K, V, A> {
    #[stable(feature = "entry_or_default", since = "1.28.0")]
    /// 如果为空，则插入默认值以确保值存在于条目中，
    /// 并返回对条目中值的可修改引用。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::BTreeMap;
    ///
    /// let mut map: BTreeMap<&str, Option<usize>> = BTreeMap::new();
    /// map.entry("poneyland").or_default();
    ///
    /// assert_eq!(map["poneyland"], None);
    /// ```
    pub fn or_default(self) -> &'a mut V {
        match self {
            Occupied(entry) => entry.into_mut(),
            Vacant(entry) => entry.insert(Default::default()),
        }
    }
}

impl<'a, K: Ord, V, A: AllocatorClone> VacantEntry<'a, K, V, A> {
    /// 获取用于通过 VacantEntry 插入值时使用的键的引用。
    /// # 示例
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::BTreeMap;
    ///
    /// let mut map: BTreeMap<&str, usize> = BTreeMap::new();
    /// assert_eq!(map.entry("poneyland").key(), &"poneyland");
    /// ```
    #[stable(feature = "map_entry_keys", since = "1.10.0")]
    pub fn key(&self) -> &K {
        &self.key
    }

    /// 获取键的所有权。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::BTreeMap;
    /// use std::collections::btree_map::Entry;
    ///
    /// let mut map: BTreeMap<&str, usize> = BTreeMap::new();
    ///
    /// if let Entry::Vacant(v) = map.entry("poneyland") {
    ///     v.into_key();
    /// }
    /// ```
    #[stable(feature = "map_entry_recover_keys2", since = "1.12.0")]
    pub fn into_key(self) -> K {
        self.key
    }

    /// Sets the value of the entry with the `VacantEntry`'s key,
    /// 并返回对其的可修改引用。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::BTreeMap;
    /// use std::collections::btree_map::Entry;
    ///
    /// let mut map: BTreeMap<&str, u32> = BTreeMap::new();
    ///
    /// if let Entry::Vacant(o) = map.entry("poneyland") {
    ///     o.insert(37);
    /// }
    /// assert_eq!(map["poneyland"], 37);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_confusables("push", "put")]
    pub fn insert(self, value: V) -> &'a mut V {
        self.insert_entry(value).into_mut()
    }

    /// Sets the value of the entry with the `VacantEntry`'s key,
    /// and returns an `OccupiedEntry`.
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::BTreeMap;
    /// use std::collections::btree_map::Entry;
    ///
    /// let mut map: BTreeMap<&str, u32> = BTreeMap::new();
    ///
    /// if let Entry::Vacant(o) = map.entry("poneyland") {
    ///     let entry = o.insert_entry(37);
    ///     assert_eq!(entry.get(), &37);
    /// }
    /// assert_eq!(map["poneyland"], 37);
    /// ```
    #[stable(feature = "btree_entry_insert", since = "1.92.0")]
    pub fn insert_entry(mut self, value: V) -> OccupiedEntry<'a, K, V, A> {
        let handle = match self.handle {
            None => {
                // SAFETY: There is no tree yet so no reference to it exists.
                let map = unsafe { self.dormant_map.reborrow() };
                let root = map.root.insert(NodeRef::new_leaf(self.alloc.clone()).forget_type());
                // SAFETY: We *just* created the root as a leaf, and we're
                // stacking the new handle on the original borrow lifetime.
                unsafe {
                    let mut leaf = root.borrow_mut().cast_to_leaf_unchecked();
                    leaf.push_with_handle(self.key, value)
                }
            }
            Some(handle) => handle.insert_recursing(self.key, value, self.alloc.clone(), |ins| {
                drop(ins.left);
                // SAFETY: Pushing a new root node doesn't invalidate
                // handles to existing nodes.
                let map = unsafe { self.dormant_map.reborrow() };
                let root = map.root.as_mut().unwrap(); // same as ins.left
                root.push_internal_level(self.alloc.clone()).push(ins.kv.0, ins.kv.1, ins.right)
            }),
        };

        // SAFETY: modifying the length doesn't invalidate handles to existing nodes.
        unsafe { self.dormant_map.reborrow().length += 1 };

        OccupiedEntry {
            handle: handle.forget_node_type(),
            dormant_map: self.dormant_map,
            alloc: self.alloc,
            _marker: PhantomData,
        }
    }
}

impl<'a, K: Ord, V, A: AllocatorClone> OccupiedEntry<'a, K, V, A> {
    /// 获取条目中键的引用。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::BTreeMap;
    ///
    /// let mut map: BTreeMap<&str, usize> = BTreeMap::new();
    /// map.entry("poneyland").or_insert(12);
    /// assert_eq!(map.entry("poneyland").key(), &"poneyland");
    /// ```
    #[must_use]
    #[stable(feature = "map_entry_keys", since = "1.10.0")]
    pub fn key(&self) -> &K {
        self.handle.reborrow().into_kv().0
    }

    /// 将条目转换为对其键的引用。
    pub(crate) fn into_key(self) -> &'a K {
        self.handle.into_kv_mut().0
    }

    /// 获取映射中的键和值的所有权。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::BTreeMap;
    /// use std::collections::btree_map::Entry;
    ///
    /// let mut map: BTreeMap<&str, usize> = BTreeMap::new();
    /// map.entry("poneyland").or_insert(12);
    ///
    /// if let Entry::Occupied(o) = map.entry("poneyland") {
    ///     // We delete the entry from the map.
    ///     o.remove_entry();
    /// }
    ///
    /// // If now try to get the value, it will panic:
    /// // println!("{}", map["poneyland"]);
    /// ```
    #[stable(feature = "map_entry_recover_keys2", since = "1.12.0")]
    pub fn remove_entry(self) -> (K, V) {
        self.remove_kv()
    }

    /// 获取条目中值的引用。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::BTreeMap;
    /// use std::collections::btree_map::Entry;
    ///
    /// let mut map: BTreeMap<&str, usize> = BTreeMap::new();
    /// map.entry("poneyland").or_insert(12);
    ///
    /// if let Entry::Occupied(o) = map.entry("poneyland") {
    ///     assert_eq!(o.get(), &12);
    /// }
    /// ```
    #[must_use]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn get(&self) -> &V {
        self.handle.reborrow().into_kv().1
    }

    /// 获取条目中值的可修改引用。
    ///
    /// If you need a reference to the `OccupiedEntry` that may outlive the
    /// destruction of the `Entry` value, see [`into_mut`].
    ///
    /// [`into_mut`]: OccupiedEntry::into_mut
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::BTreeMap;
    /// use std::collections::btree_map::Entry;
    ///
    /// let mut map: BTreeMap<&str, usize> = BTreeMap::new();
    /// map.entry("poneyland").or_insert(12);
    ///
    /// assert_eq!(map["poneyland"], 12);
    /// if let Entry::Occupied(mut o) = map.entry("poneyland") {
    ///     *o.get_mut() += 10;
    ///     assert_eq!(*o.get(), 22);
    ///
    ///     // We can use the same Entry multiple times.
    ///     *o.get_mut() += 2;
    /// }
    /// assert_eq!(map["poneyland"], 24);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn get_mut(&mut self) -> &mut V {
        self.handle.kv_mut().1
    }

    /// 将条目转换为对其值的可修改引用。
    ///
    /// If you need multiple references to the `OccupiedEntry`, see [`get_mut`].
    ///
    /// [`get_mut`]: OccupiedEntry::get_mut
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::BTreeMap;
    /// use std::collections::btree_map::Entry;
    ///
    /// let mut map: BTreeMap<&str, usize> = BTreeMap::new();
    /// map.entry("poneyland").or_insert(12);
    ///
    /// assert_eq!(map["poneyland"], 12);
    /// if let Entry::Occupied(o) = map.entry("poneyland") {
    ///     *o.into_mut() += 10;
    /// }
    /// assert_eq!(map["poneyland"], 22);
    /// ```
    #[must_use = "`self` will be dropped if the result is not used"]
    #[stable(feature = "rust1", since = "1.0.0")]
    pub fn into_mut(self) -> &'a mut V {
        self.handle.into_val_mut()
    }

    /// Sets the value of the entry with the `OccupiedEntry`'s key,
    /// 并返回条目的旧值。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::BTreeMap;
    /// use std::collections::btree_map::Entry;
    ///
    /// let mut map: BTreeMap<&str, usize> = BTreeMap::new();
    /// map.entry("poneyland").or_insert(12);
    ///
    /// if let Entry::Occupied(mut o) = map.entry("poneyland") {
    ///     assert_eq!(o.insert(15), 12);
    /// }
    /// assert_eq!(map["poneyland"], 15);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_confusables("push", "put")]
    pub fn insert(&mut self, value: V) -> V {
        mem::replace(self.get_mut(), value)
    }

    /// 从映射中获取条目的值并返回它。
    ///
    /// # 示例
    ///
    /// ```
    /// use std::collections::BTreeMap;
    /// use std::collections::btree_map::Entry;
    ///
    /// let mut map: BTreeMap<&str, usize> = BTreeMap::new();
    /// map.entry("poneyland").or_insert(12);
    ///
    /// if let Entry::Occupied(o) = map.entry("poneyland") {
    ///     assert_eq!(o.remove(), 12);
    /// }
    /// // If we try to get "poneyland"'s value, it'll panic:
    /// // println!("{}", map["poneyland"]);
    /// ```
    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_confusables("delete", "take")]
    pub fn remove(self) -> V {
        self.remove_kv().1
    }

    // Body of `remove_entry`, probably separate because the name reflects the returned pair.
    pub(super) fn remove_kv(self) -> (K, V) {
        let mut emptied_internal_root = false;
        let (old_kv, _) =
            self.handle.remove_kv_tracking(|| emptied_internal_root = true, self.alloc.clone());
        // SAFETY: we consumed the intermediate root borrow, `self.handle`.
        let map = unsafe { self.dormant_map.awaken() };
        map.length -= 1;
        if emptied_internal_root {
            let root = map.root.as_mut().unwrap();
            root.pop_internal_level(self.alloc);
        }
        old_kv
    }
}
