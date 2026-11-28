use crate::ffi::{CStr, CString, c_char};
use crate::ops::Index;
use crate::{fmt, mem, ptr};

/// 用于管理 C 风格数组中字符串所有权的辅助类型。
///
/// 该类型管理由 null 结尾的 C 字符串指针数组。
/// pointer. The pointer to the array (as returned by `as_ptr`) can be used as
/// a value of `argv` or `environ`.
pub struct CStringArray {
    ptrs: Vec<*const c_char>,
}

impl CStringArray {
    /// Creates a new `CStringArray` with enough capacity to hold `capacity`
    /// 字符串。
    pub fn with_capacity(capacity: usize) -> Self {
        let mut result = CStringArray { ptrs: Vec::with_capacity(capacity + 1) };
        result.ptrs.push(ptr::null());
        result
    }

    /// Replace the string at position `index`.
    pub fn write(&mut self, index: usize, item: CString) {
        let argc = self.ptrs.len() - 1;
        let ptr = &mut self.ptrs[..argc][index];
        let old = mem::replace(ptr, item.into_raw());
        // SAFETY:
        // `CStringArray` owns all of its strings, and they were all transformed
        // into pointers using `CString::into_raw`. Also, this is not the null
        // pointer since the indexing above would have failed.
        drop(unsafe { CString::from_raw(old.cast_mut()) });
    }

    /// 向数组中追加一个字符串。
    pub fn push(&mut self, item: CString) {
        let argc = self.ptrs.len() - 1;
        // Amend the array by another null pointer first, to ensure that the
        // array is null-terminated even when the `push` panics, in which case
        // the array will be left undisturbed (see #155748).
        self.ptrs.push(ptr::null());
        // Now, replace the previous null pointer.
        self.ptrs[argc] = item.into_raw();
    }

    /// 返回该类型管理的 C 字符串数组的指针。
    pub fn as_ptr(&self) -> *const *const c_char {
        self.ptrs.as_ptr()
    }

    /// Returns an iterator over all `CStr`s contained in this array.
    pub fn iter(&self) -> CStringIter<'_> {
        CStringIter { iter: self.ptrs[..self.ptrs.len() - 1].iter() }
    }
}

impl Index<usize> for CStringArray {
    type Output = CStr;
    fn index(&self, index: usize) -> &CStr {
        let ptr = self.ptrs[..self.ptrs.len() - 1][index];
        // SAFETY:
        // `CStringArray` owns all of its strings. Also, this is not the null
        // pointer since the indexing above would have failed.
        unsafe { CStr::from_ptr(ptr) }
    }
}

impl fmt::Debug for CStringArray {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_list().entries(self.iter()).finish()
    }
}

// SAFETY: `CStringArray` is basically just a `Vec<CString>`
unsafe impl Send for CStringArray {}
// SAFETY: `CStringArray` is basically just a `Vec<CString>`
unsafe impl Sync for CStringArray {}

impl Drop for CStringArray {
    fn drop(&mut self) {
        // SAFETY:
        // `CStringArray` owns all of its strings, and they were all transformed
        // into pointers using `CString::into_raw`.
        self.ptrs[..self.ptrs.len() - 1]
            .iter()
            .for_each(|&p| drop(unsafe { CString::from_raw(p.cast_mut()) }))
    }
}

/// An iterator over all `CStr`s contained in a `CStringArray`.
#[derive(Clone)]
pub struct CStringIter<'a> {
    iter: crate::slice::Iter<'a, *const c_char>,
}

// SAFETY: `CStringIter` is basically just a `slice::Iter<&'a CStr>`
unsafe impl Send for CStringIter<'_> {}
// SAFETY: `CStringIter` is basically just a `slice::Iter<&'a CStr>`
unsafe impl Sync for CStringIter<'_> {}

impl<'a> Iterator for CStringIter<'a> {
    type Item = &'a CStr;
    fn next(&mut self) -> Option<&'a CStr> {
        // SAFETY:
        // `CStringArray` owns all of its strings. Also, this is not the null
        // pointer since the last element is excluded when creating `iter`.
        self.iter.next().map(|&p| unsafe { CStr::from_ptr(p) })
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        self.iter.size_hint()
    }
}

impl<'a> ExactSizeIterator for CStringIter<'a> {
    fn len(&self) -> usize {
        self.iter.len()
    }
    fn is_empty(&self) -> bool {
        self.iter.is_empty()
    }
}
