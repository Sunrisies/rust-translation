//! Implementation of the `thread_local` macro.
//!
//! 有三种不同的线程本地实现方式：
//! * 某些目标不支持线程支持，因此只有单个线程，
//!   the TLS data is stored in a normal `static`.
//! * 某些目标通过动态链接器和 C 运行时原生支持 TLS。
//! * 在某些目标上，操作系统提供基于库的 TLS 实现。
//! TLS 数据在堆上分配，并通过 TLS 密钥进行引用。
//!
//! Each implementation provides a macro which generates the `LocalKey` `const`
//! 来引用 TLS 变量，以及必要的辅助结构体
//! 以跟踪变量的初始化/销毁状态。
//!
//! 此外，该模块还包含用于这些实现的操作系统接口的抽象。
//! 的抽象。

#![cfg_attr(test, allow(unused))]
#![doc(hidden)]
#![forbid(unsafe_op_in_unsafe_fn)]
#![unstable(
    feature = "thread_local_internals",
    reason = "internal details of the thread_local macro",
    issue = "none"
)]
#![deny(
    clippy::arithmetic_side_effects,
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::indexing_slicing,
    clippy::panic,
    clippy::unreachable,
    clippy::unimplemented,
    reason = "TLS accesses must not call the global allocator, including via panic (#160930)"
)]

cfg_select! {
    any(
        all(target_family = "wasm", not(target_feature = "atomics"), not(target_os = "wasi")),
        target_os = "uefi",
        target_os = "zkvm",
        target_os = "trusty",
        target_os = "vexos",
    ) => {
        mod no_threads;
        pub use no_threads::{EagerStorage, LazyStorage, thread_local_inner};
        pub(crate) use no_threads::{LocalPointer, local_pointer};
    }
    target_thread_local => {
        mod native;
        pub use native::{EagerStorage, LazyStorage, thread_local_inner};
        pub(crate) use native::{LocalPointer, local_pointer};
    }
    _ => {
        mod os;
        pub(crate) use os::{LocalPointer, local_pointer};
        pub use os::{Storage, thread_local_inner, value_align};
    }
}

/// 原生 TLS 实现需要一种方式为其数据注册析构函数。
/// 该模块包含针对平台的这种注册实现。
///
/// 然而，大多数平台没有一种方式可以注册每个变量的
/// destructor for each variable. On these platforms, we keep track of the
/// destructors ourselves and register (through the [`guard`] module) only a
/// 这个模块提供了一种调度析构函数列表执行的机制。
#[cfg(all(
    target_thread_local,
    not(all(target_family = "wasm", not(target_feature = "atomics"), not(target_os = "wasi")))
))]
pub(crate) mod destructors {
    cfg_select! {
        any(
            target_os = "linux",
            target_os = "android",
            target_os = "fuchsia",
            target_os = "redox",
            target_os = "hurd",
            target_os = "netbsd",
            target_os = "dragonfly"
        ) => {
            mod linux_like;
            mod list;
            pub(super) use linux_like::register;
            pub(super) use list::run;
        }
        _ => {
            mod list;
            pub(super) use list::register;
            pub(crate) use list::run;
        }
    }
}

/// This module provides a way to schedule the execution of the destructor list
/// and the [runtime cleanup](crate::rt::thread_cleanup) function. Calling `enable`
/// sets up the current thread to ensure that these functions are called at the right times.
pub(crate) mod guard {
    cfg_select! {
        all(target_thread_local, target_vendor = "apple") => {
            mod apple;
            pub(crate) use apple::enable;
        }
        all(target_thread_local, target_os = "aix") => {
            mod aix;
            pub(crate) use aix::enable;
        }
        target_os = "windows" => {
            mod windows;
            pub(crate) use windows::enable;
            #[cfg(not(target_thread_local))]
            mod retained;
            #[cfg(not(target_thread_local))]
            pub(crate) use retained::{LOCAL_POINTER_NEEDS_DTOR, cleanup_pending};
        }
        any(
            all(target_family = "wasm", not(target_os = "wasi")),
            target_os = "uefi",
            target_os = "zkvm",
            target_os = "trusty",
            target_os = "vexos",
        ) => {
            pub(crate) fn enable() {
                // FIXME: Right now there is no concept of "thread exit" on
                // wasm, but this is likely going to show up at some point in
                // the form of an exported symbol that the wasm runtime is going
                // to be expected to call. For now we just leak everything, but
                // if such a function starts to exist it will probably need to
                // iterate the destructor list with these functions:
                #[cfg(all(target_family = "wasm", target_feature = "atomics"))]
                #[allow(unused)]
                use super::destructors::run;
                #[allow(unused)]
                use crate::rt::thread_cleanup;
            }
        }
        any(target_os = "hermit", target_os = "xous") => {
            // `std` is the only runtime, so it just calls the destructor functions
            // itself when the time comes.
            pub(crate) fn enable() {}
            #[cfg(not(target_thread_local))]
            mod retained;
            #[cfg(not(target_thread_local))]
            pub(crate) use retained::{LOCAL_POINTER_NEEDS_DTOR, cleanup_pending};
        }
        target_os = "solid_asp3" => {
            mod solid;
            pub(crate) use solid::enable;
        }
        _ => {
            mod key;
            pub(crate) use key::enable;
            #[cfg(not(target_thread_local))]
            pub(crate) use key::{LOCAL_POINTER_NEEDS_DTOR, cleanup_pending};
        }
    }
}

/// `const`-creatable TLS keys.
///
/// 大多数没有原生 TLS 的操作系统会提供基于库的方式创建 TLS
/// 存储。对于每个 TLS 变量，我们创建一个密钥，然后可以使用该密钥
/// 在线程本地表中引用一个条目。这样，每个密钥与指针关联，我们可以获取并设置该指针以存储数据。
/// 在一个不能回溯的场景中运行回调（例如用户 crate 中声明的 `extern "C`
pub(crate) mod key {
    cfg_select! {
        any(
            all(not(target_vendor = "apple"), not(target_family = "wasm"), target_family = "unix"),
            all(not(target_thread_local), target_vendor = "apple"),
            target_os = "teeos",
            target_os = "wasi",
        ) => {
            mod racy;
            mod unix;
            #[cfg(test)]
            mod tests;
            pub(super) use racy::LazyKey;
            #[cfg(any(not(target_thread_local), test))]
            pub(super) use unix::get;
            pub(super) use unix::{Key, set};
            use unix::{create, destroy};
        }
        all(not(target_thread_local), target_os = "windows") => {
            #[cfg(test)]
            mod tests;
            mod windows;
            pub(super) use windows::{Key, LazyKey, get, run_dtors, set};
        }
        all(target_vendor = "fortanix", target_env = "sgx") => {
            mod racy;
            mod sgx;
            #[cfg(test)]
            mod tests;
            pub(super) use racy::LazyKey;
            pub(super) use sgx::{Key, get, set};
            use sgx::{create, destroy};
        }
        target_os = "xous" => {
            mod racy;
            #[cfg(test)]
            mod tests;
            mod xous;
            pub(super) use racy::LazyKey;
            pub(crate) use xous::destroy_tls;
            pub(super) use xous::{Key, get, set};
            use xous::{create, destroy};
        }
        target_os = "motor" => {
            mod racy;
            #[cfg(test)]
            mod tests;
            pub(super) use moto_rt::tls::{Key, get, set};
            use moto_rt::tls::{create, destroy};
            pub(super) use racy::LazyKey;
        }
        _ => {}
    }
}

/// `fn`）。如果回调无论如何都会回溯，则
/// fn` declared in a user crate). If the callback unwinds anyway, then
/// `rtabort` with a message about thread local panicking on drop.
#[inline]
#[allow(dead_code)]
fn abort_on_dtor_unwind(f: impl FnOnce()) {
    // Using a guard like this is lower cost.
    let guard = DtorUnwindGuard;
    f();
    core::mem::forget(guard);

    struct DtorUnwindGuard;
    impl Drop for DtorUnwindGuard {
        #[inline]
        fn drop(&mut self) {
            // This is not terribly descriptive, but it doesn't need to be as we'll
            // already have printed a panic message at this point.
            rtabort!("thread local panicked on drop");
        }
    }
}
