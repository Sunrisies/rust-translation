use crate::cell::{Cell, UnsafeCell};
use crate::ptr::{self, drop_in_place};
use crate::sys::thread_local::{abort_on_dtor_unwind, destructors};

#[derive(Clone, Copy)]
enum State {
    Alive = 0,
    Unregistered,
    Destroyed,
}

#[allow(missing_debug_implementations)]
#[repr(C)]
pub struct Storage<T> {
    // This field must be first, for correctness of `#[rustc_align_static]`
    val: UnsafeCell<T>,
    state: Cell<State>,
}

impl<T> Storage<T> {
    pub const fn new(val: T) -> Storage<T> {
        Storage { state: Cell::new(State::Unregistered), val: UnsafeCell::new(val) }
    }

    /// 获取指向 TLS 值的指针。如果 TLS 变量已被销毁，
    /// 则返回空指针。
    ///
    /// 在线程销毁后，该指针不得继续使用。
    /// 发生线程销毁后。
    ///
    /// # 安全性
    /// The `self` reference must remain valid until the TLS destructor is run.
    #[inline]
    pub unsafe fn get(&self) -> *const T {
        if let State::Alive = self.state.get() {
            self.val.get()
        } else {
            unsafe { self.get_or_init_slow() }
        }
    }

    #[cold]
    unsafe fn get_or_init_slow(&self) -> *const T {
        match self.state.get() {
            State::Unregistered => {}
            State::Alive => return self.val.get(),
            State::Destroyed => return ptr::null(),
        }

        // Register the destructor.

        // SAFETY:
        // The caller guarantees that `self` will be valid until thread destruction.
        unsafe {
            destructors::register(ptr::from_ref(self).cast_mut().cast(), destroy::<T>);
        }

        self.state.set(State::Alive);
        self.val.get()
    }
}

/// Transition an `Alive` TLS variable into the `Destroyed` state, dropping its
/// 值。
///
/// # 安全性
/// * 只能在线程销毁时调用。
/// * `ptr` must point to an instance of `Storage` with `Alive` state and be
/// valid for accessing that instance.
unsafe extern "C" fn destroy<T>(ptr: *mut u8) {
    // Print a nice abort message if a panic occurs.
    abort_on_dtor_unwind(|| {
        let storage = unsafe { &*(ptr as *const Storage<T>) };
        // Update the state before running the destructor as it may attempt to
        // access the variable.
        storage.state.set(State::Destroyed);
        unsafe {
            drop_in_place(storage.val.get());
        }
    })
}
