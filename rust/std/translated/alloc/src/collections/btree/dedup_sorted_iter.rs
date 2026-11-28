use core::iter::Peekable;

/// 用于去重排序迭代器键的迭代器。
/// 当遇到重复键时，仅输出最后一个键值对。
///
/// Used by [`BTreeMap::bulk_build_from_sorted_iter`][1].
///
/// [1]: crate::collections::BTreeMap::bulk_build_from_sorted_iter
pub(super) struct DedupSortedIter<K, V, I>
where
    I: Iterator<Item = (K, V)>,
{
    iter: Peekable<I>,
}

impl<K, V, I> DedupSortedIter<K, V, I>
where
    I: Iterator<Item = (K, V)>,
{
    pub(super) fn new(iter: I) -> Self {
        Self { iter: iter.peekable() }
    }
}

impl<K, V, I> Iterator for DedupSortedIter<K, V, I>
where
    K: Eq,
    I: Iterator<Item = (K, V)>,
{
    type Item = (K, V);

    fn next(&mut self) -> Option<(K, V)> {
        loop {
            let next = match self.iter.next() {
                Some(next) => next,
                None => return None,
            };

            let peeked = match self.iter.peek() {
                Some(peeked) => peeked,
                None => return Some(next),
            };

            if next.0 != peeked.0 {
                return Some(next);
            }
        }
    }
}
