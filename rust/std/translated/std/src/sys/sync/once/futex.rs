use crate::cell::Cell;
use crate::sync as public;
use crate::sync::atomic::Ordering::{Acquire, Relaxed, Release};
use crate::sync::once::OnceExclusiveState;
use crate::sys::sync::futex::{Futex, Primitive, futex_wait, futex_wake_all};

// On some platforms, the OS is very nice and handles the waiter queue for us.
// This means we only need one atomic value with 4 states:

/// 尚未执行初始化，且没有任何线程正在使用 `Once` 类型。
const INCOMPLETE: Primitive = 3;
/// 某些线程之前尝试初始化 `Once`，但引发了 panic 错误。
/// 因此，`Once` 现在处于中毒状态。目前没有其他线程访问它。
/// 此 `Once` 目前没有被使用。
const POISONED: Primitive = 2;
/// 某个线程正在尝试执行初始化过程。它可能会成功。
/// 所以所有未来的线程都需要等待初始化完成。
const RUNNING: Primitive = 1;
/// 初始化已完成，所有后续调用应会立即执行完毕。
/// By choosing this state as the all-zero state the `is_completed` check can be
/// 如果状态不是 `COMPLETE`，则只能设置此值。
const COMPLETE: Primitive = 0;

// An additional bit indicates whether there are waiting threads:

/// May only be set if the state is not COMPLETE.
const QUEUED: Primitive = 4;

// Threads wait by setting the QUEUED bit and calling `futex_wait` on the state
// variable. When the running thread finishes, it will wake all waiting threads using
// `futex_wake_all`.

const STATE_MASK: Primitive = 0b11;

pub struct OnceState {
    poisoned: bool,
    set_state_to: Cell<Primitive>,
}

impl OnceState {
    #[inline]
    pub fn is_poisoned(&self) -> bool {
        self.poisoned
    }

    #[inline]
    pub fn poison(&self) {
        self.set_state_to.set(POISONED);
    }
}

struct CompletionGuard<'a> {
    state_and_queued: &'a Futex,
    set_state_on_drop_to: Primitive,
}

impl<'a> Drop for CompletionGuard<'a> {
    fn drop(&mut self) {
        // Use release ordering to propagate changes to all threads checking
        // up on the Once. `futex_wake_all` does its own synchronization, hence
        // we do not need `AcqRel`.
        if self.state_and_queued.swap(self.set_state_on_drop_to, Release) & QUEUED != 0 {
            futex_wake_all(self.state_and_queued);
        }
    }
}

pub struct Once {
    state_and_queued: Futex,
}

impl Once {
    #[inline]
    pub const fn new() -> Once {
        Once { state_and_queued: Futex::new(INCOMPLETE) }
    }

    #[inline]
    pub const fn new_complete() -> Once {
        Once { state_and_queued: Futex::new(COMPLETE) }
    }

    #[inline]
    pub fn is_completed(&self) -> bool {
        // Use acquire ordering to make all initialization changes visible to the
        // current thread.
        self.state_and_queued.load(Acquire) == COMPLETE
    }

    #[inline]
    pub(crate) fn state(&mut self) -> OnceExclusiveState {
        match *self.state_and_queued.get_mut() {
            INCOMPLETE => OnceExclusiveState::Incomplete,
            POISONED => OnceExclusiveState::Poisoned,
            COMPLETE => OnceExclusiveState::Complete,
            _ => unreachable!("invalid Once state"),
        }
    }

    #[inline]
    pub(crate) fn set_state(&mut self, new_state: OnceExclusiveState) {
        *self.state_and_queued.get_mut() = match new_state {
            OnceExclusiveState::Incomplete => INCOMPLETE,
            OnceExclusiveState::Poisoned => POISONED,
            OnceExclusiveState::Complete => COMPLETE,
        };
    }

    #[cold]
    #[track_caller]
    pub fn wait(&self, ignore_poisoning: bool) {
        let mut state_and_queued = self.state_and_queued.load(Acquire);
        loop {
            let state = state_and_queued & STATE_MASK;
            let queued = state_and_queued & QUEUED != 0;
            match state {
                COMPLETE => return,
                POISONED if !ignore_poisoning => {
                    // Panic to propagate the poison.
                    panic!("Once instance has previously been poisoned");
                }
                _ => {
                    // Set the QUEUED bit if it has not already been set.
                    if !queued {
                        state_and_queued += QUEUED;
                        if let Err(new) = self.state_and_queued.compare_exchange_weak(
                            state,
                            state_and_queued,
                            Relaxed,
                            Acquire,
                        ) {
                            state_and_queued = new;
                            continue;
                        }
                    }

                    futex_wait(&self.state_and_queued, state_and_queued, None);
                    state_and_queued = self.state_and_queued.load(Acquire);
                }
            }
        }
    }

    #[cold]
    #[track_caller]
    pub fn call(&self, ignore_poisoning: bool, f: &mut dyn FnMut(&public::OnceState)) {
        let mut state_and_queued = self.state_and_queued.load(Acquire);
        loop {
            let state = state_and_queued & STATE_MASK;
            let queued = state_and_queued & QUEUED != 0;
            match state {
                COMPLETE => return,
                POISONED if !ignore_poisoning => {
                    // Panic to propagate the poison.
                    panic!("Once instance has previously been poisoned");
                }
                INCOMPLETE | POISONED => {
                    // Try to register the current thread as the one running.
                    let next = RUNNING + if queued { QUEUED } else { 0 };
                    if let Err(new) = self.state_and_queued.compare_exchange_weak(
                        state_and_queued,
                        next,
                        Acquire,
                        Acquire,
                    ) {
                        state_and_queued = new;
                        continue;
                    }

                    // `waiter_queue` will manage other waiting threads, and
                    // wake them up on drop.
                    let mut waiter_queue = CompletionGuard {
                        state_and_queued: &self.state_and_queued,
                        set_state_on_drop_to: POISONED,
                    };
                    // Run the function, letting it know if we're poisoned or not.
                    let f_state = public::OnceState {
                        inner: OnceState {
                            poisoned: state == POISONED,
                            set_state_to: Cell::new(COMPLETE),
                        },
                    };
                    f(&f_state);
                    waiter_queue.set_state_on_drop_to = f_state.inner.set_state_to.get();
                    return;
                }
                _ => {
                    // All other values must be RUNNING.
                    assert!(state == RUNNING);

                    // Set the QUEUED bit if it is not already set.
                    if !queued {
                        state_and_queued += QUEUED;
                        if let Err(new) = self.state_and_queued.compare_exchange_weak(
                            state,
                            state_and_queued,
                            Relaxed,
                            Acquire,
                        ) {
                            state_and_queued = new;
                            continue;
                        }
                    }

                    futex_wait(&self.state_and_queued, state_and_queued, None);
                    state_and_queued = self.state_and_queued.load(Acquire);
                }
            }
        }
    }
}
