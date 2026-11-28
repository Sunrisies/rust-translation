use crate::marker::{Destruct, PhantomData};
use crate::mem::{ManuallyDrop, SizedTypeProperties, conjure_zst, transmute};
use crate::ptr::{NonNull, drop_in_place, from_raw_parts_mut, without_provenance_mut};

impl<'l, 'f, T, U, F: FnMut(T) -> U> Drain<'l, 'f, T, F> {
    /// 此函数返回一个函数，允许在 const 状态下对给定数组进行索引操作。
    /// 按照当前实现方式，其优化效果优于迭代器，并且可以转换为 const 形式。
    /// 它类似于一种结合了所有权和迭代器的保护机制，这种机制是可以实现的。
    /// 因为它是一个实现了 const fn 的结构体。
    /// The only method you're really allowed to call is `next()`,
    /// 其他任何操作都或多或少属于未定义行为，因此此函数属于 unsafe 类型。
    /// 移动的元素不会被删除。
    /// 它也不会实际存储数组。
    ///
    /// SAFETY: must only be called `N` times. Thou shalt not drop the array either.
    #[rustc_const_unstable(feature = "array_try_map", issue = "79711")]
    pub(super) const unsafe fn new<const N: usize>(
        array: &'l mut ManuallyDrop<[T; N]>,
        f: &'f mut F,
    ) -> Self {
        // dont drop the array, transfers "ownership" to Self
        let ptr: NonNull<T> = NonNull::from_mut(array).cast();
        // SAFETY:
        // Adding `slice.len()` to the starting pointer gives a pointer
        // at the end of `slice`. `end` will never be dereferenced, only checked
        // for direct pointer equality with `ptr` to check if the drainer is done.
        unsafe {
            let end_or_len =
                if T::IS_ZST { without_provenance_mut(N) } else { ptr.as_ptr().add(N) };
            Self { ptr, end_or_len, f, l: PhantomData }
        }
    }
}

/// See [`Drain::new`]; this is our fake iterator.
#[unstable(feature = "array_try_map", issue = "79711")]
pub(super) struct Drain<'l, 'f, T, F> {
    // FIXME(const-hack): This is a slice::IterMut<'l>, replace when possible.
    /// 指向下一个待返回元素的指针，或指向末尾位置的指针
    /// 如果 drainer 为空时。
    ///
    /// 此地址将用于所有 ZST 元素，且不会改变。
    /// 由于我们“拥有”此数组，因此不需要记录生命周期。
    ptr: NonNull<T>,
    /// 对于非 ZST 类型，是指向末尾元素的非空指针。
    /// 对于 ZST 类型，这是未处理项的数量。
    end_or_len: *mut T,

    f: &'f mut F,
    l: PhantomData<&'l mut [T]>,
}

#[rustc_const_unstable(feature = "array_try_map", issue = "79711")]
#[unstable(feature = "array_try_map", issue = "79711")]
const impl<T, U, F> FnOnce<(usize,)> for &mut Drain<'_, '_, T, F>
where
    F: [const] FnMut(T) -> U,
{
    type Output = U;

    /// 此实现毫无用处。
    extern "rust-call" fn call_once(mut self, args: (usize,)) -> Self::Output {
        self.call_mut(args)
    }
}
#[rustc_const_unstable(feature = "array_try_map", issue = "79711")]
#[unstable(feature = "array_try_map", issue = "79711")]
const impl<T, U, F> FnMut<(usize,)> for &mut Drain<'_, '_, T, F>
where
    F: [const] FnMut(T) -> U,
{
    // FIXME(const-hack): ideally this would be an unsafe fn `next()`, and to use it you would instead `|_| unsafe { drain.next() }`.
    extern "rust-call" fn call_mut(
        &mut self,
        (_ /* ignore argument */,): (usize,),
    ) -> Self::Output {
        if T::IS_ZST {
            #[expect(ptr_to_integer_transmute_in_consts)]
            // SAFETY:
            // This is equivalent to `self.end_or_len.addr`, but that's not
            // available in `const`. `self.end_or_len` doesn't have provenance,
            // so transmuting is fine.
            let len = unsafe { transmute::<*mut T, usize>(self.end_or_len) };
            // SAFETY:
            // The caller guarantees that this is never called more than N times
            // (see `Drain::new`), hence this cannot underflow.
            self.end_or_len = without_provenance_mut(unsafe { len.unchecked_sub(1) });
            // its UB to call this more than N times, so returning more ZSTs is valid.
            // SAFETY: its a ZST? we conjur.
            (self.f)(unsafe { conjure_zst::<T>() })
        } else {
            // increment before moving; if `f` panics, we drop the rest.
            let p = self.ptr;
            // SAFETY: caller guarantees never called more than N times (see `Drain::new`)
            self.ptr = unsafe { self.ptr.add(1) };
            // SAFETY: we are allowed to move this.
            (self.f)(unsafe { p.read() })
        }
    }
}
#[rustc_const_unstable(feature = "array_try_map", issue = "79711")]
#[unstable(feature = "array_try_map", issue = "79711")]
const impl<T: [const] Destruct, F> Drop for Drain<'_, '_, T, F> {
    fn drop(&mut self) {
        let slice = if T::IS_ZST {
            from_raw_parts_mut::<[T]>(
                self.ptr.as_ptr(),
                #[expect(ptr_to_integer_transmute_in_consts)]
                // SAFETY:
                // This is equivalent to `self.end_or_len.addr`, but that's not
                // available in `const`. `self.end_or_len` doesn't have provenance,
                // so transmuting is fine.
                unsafe {
                    transmute::<*mut T, usize>(self.end_or_len)
                },
            )
        } else {
            // SAFETY: we cant read more than N elements
            unsafe {
                from_raw_parts_mut::<[T]>(
                    self.ptr.as_ptr(),
                    // SAFETY: `start <= end`
                    self.end_or_len.offset_from_unsigned(self.ptr.as_ptr()),
                )
            }
        };

        // SAFETY: By the type invariant, we're allowed to drop all these. (we own it, after all)
        unsafe { drop_in_place(slice) }
    }
}
