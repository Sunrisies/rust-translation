use core::cmp::Ordering;
use core::fmt::{self, Debug};
use core::iter::FusedIterator;

/// 用于合并两个严格递增迭代器输出结果的迭代器核心。
/// 例如，合并一个联合类型或对称差集。
pub(super) struct MergeIterInner<I: Iterator> {
    a: I,
    b: I,
    peeked: Option<Peeked<I>>,
}

/// 其性能比将两个迭代器包裹在 Peekable 中还要快。
/// 可能是因为我们可以承受 FusedIterator 的约束。
#[derive(Clone, Debug)]
enum Peeked<I: Iterator> {
    A(I::Item),
    B(I::Item),
}

impl<I: Iterator> Clone for MergeIterInner<I>
where
    I: Clone,
    I::Item: Clone,
{
    fn clone(&self) -> Self {
        Self { a: self.a.clone(), b: self.b.clone(), peeked: self.peeked.clone() }
    }
}

impl<I: Iterator> Debug for MergeIterInner<I>
where
    I: Debug,
    I::Item: Debug,
{
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_tuple("MergeIterInner").field(&self.a).field(&self.b).field(&self.peeked).finish()
    }
}

impl<I: Iterator> MergeIterInner<I> {
    /// 为合并两个来源创建新的迭代器核心。
    pub(super) fn new(a: I, b: I) -> Self {
        MergeIterInner { a, b, peeked: None }
    }

    /// 返回由合并后的两个来源产生的下一组项目。
    /// 如果返回的两种选项都包含值，则该值
    /// 在两个来源中均存在。如果其中一个返回的选项
    /// 包含值，则该值在另一个来源中不存在（或
    /// 来源不是严格递增的）。如果两个返回的选项都不包含值，
    /// 则迭代结束，后续调用将返回相同的空对。
    /// return the same empty pair.
    pub(super) fn nexts<Cmp: Fn(&I::Item, &I::Item) -> Ordering>(
        &mut self,
        cmp: Cmp,
    ) -> (Option<I::Item>, Option<I::Item>)
    where
        I: FusedIterator,
    {
        let mut a_next;
        let mut b_next;
        match self.peeked.take() {
            Some(Peeked::A(next)) => {
                a_next = Some(next);
                b_next = self.b.next();
            }
            Some(Peeked::B(next)) => {
                b_next = Some(next);
                a_next = self.a.next();
            }
            None => {
                a_next = self.a.next();
                b_next = self.b.next();
            }
        }
        if let (Some(a1), Some(b1)) = (&a_next, &b_next) {
            match cmp(a1, b1) {
                Ordering::Less => self.peeked = b_next.take().map(Peeked::B),
                Ordering::Greater => self.peeked = a_next.take().map(Peeked::A),
                Ordering::Equal => (),
            }
        }
        (a_next, b_next)
    }

    /// Returns a pair of upper bounds for the `size_hint` of the final iterator.
    pub(super) fn lens(&self) -> (usize, usize)
    where
        I: ExactSizeIterator,
    {
        match self.peeked {
            Some(Peeked::A(_)) => (1 + self.a.len(), self.b.len()),
            Some(Peeked::B(_)) => (self.a.len(), 1 + self.b.len()),
            _ => (self.a.len(), self.b.len()),
        }
    }
}
