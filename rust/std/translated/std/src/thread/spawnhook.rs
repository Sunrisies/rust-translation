use super::thread::Thread;
use crate::cell::Cell;
use crate::iter;
use crate::sync::{Arc, UniqueArc};

crate::thread_local! {
    /// 一个线程本地生成的钩子链表。
    ///
    /// 它是一个弧的链表，因此可以被生成的线程以极低的成本继承。
    ///
    /// （从技术上讲，它是一组具有共享尾部的链表，因此可以视为一棵链表树。）
    static SPAWN_HOOKS: Cell<SpawnHooks> = const { Cell::new(SpawnHooks { first: None }) };
}

#[derive(Default, Clone)]
struct SpawnHooks {
    first: Option<Arc<SpawnHook>>,
}

// Manually implement drop to prevent deep recursion when dropping linked Arc list.
impl Drop for SpawnHooks {
    fn drop(&mut self) {
        let mut next = self.first.take();
        while let Some(SpawnHook { hook, next: n }) = next.and_then(Arc::into_inner) {
            drop(hook);
            next = n;
        }
    }
}

struct SpawnHook {
    hook: Box<dyn Send + Sync + Fn(&Thread) -> Box<dyn Send + FnOnce()>>,
    next: Option<Arc<SpawnHook>>,
}

/// 为每个新生成的线程注册一个要运行的函数。
///
/// 钩子在父线程中执行，并返回一个函数。
/// 该函数在新线程中执行。
///
/// The hook is called with the `Thread` handle for the new thread.
///
/// 钩子仅添加到当前线程，并被其生成的线程继承。
/// 换句话说，添加钩子对已经运行的线程（当前线程及其未来可能生成的线程除外）没有影响。
/// 钩子按逆序运行，从最新添加的开始。
///
/// 钩子只能添加，不能移除。
///
/// Hooks can only be added, not removed.
/// Note that this does *not* mean that they are guaranteed to run. See [`Builder::no_hooks`].
/// 无法依赖钩子的运行来保证行为。
///
/// # 使用说明
///
/// ```
/// #![feature(thread_spawn_hook)]
///
/// std::thread::add_spawn_hook(|_| {
///     ..; // This will run in the parent (spawning) thread.
///     move || {
///         ..; // This will run it the child (spawned) thread.
///     }
/// });
/// ```
///
/// # 示例
///
/// 钩子可用于从父线程“继承”线程本地数据：
///
/// ```
/// #![feature(thread_spawn_hook)]
///
/// use std::cell::Cell;
///
/// thread_local! {
///     static X: Cell<u32> = Cell::new(0);
/// }
///
/// // This needs to be done once in the main thread before spawning any threads.
/// std::thread::add_spawn_hook(|_| {
///     // Get the value of X in the spawning thread.
///     let value = X.get();
///     // Set the value of X in the newly spawned thread.
///     move || X.set(value)
/// });
///
/// X.set(123);
///
/// std::thread::spawn(|| {
///     assert_eq!(X.get(), 123);
/// }).join().unwrap();
/// ```
///
/// [`Builder::no_hooks`]: crate::thread::Builder::no_hooks
#[unstable(feature = "thread_spawn_hook", issue = "132951")]
pub fn add_spawn_hook<F, G>(hook: F)
where
    F: 'static + Send + Sync + Fn(&Thread) -> G,
    G: 'static + Send + FnOnce(),
{
    SPAWN_HOOKS.with(|h| {
        // Perform all fallible operations before taking the current hooks (see #159923)
        let mut new_first = UniqueArc::new(SpawnHook {
            hook: Box::new(move |thread| Box::new(hook(thread))),
            next: None,
        });
        let mut hooks = h.take();
        new_first.next = hooks.first.take();
        hooks.first = Some(UniqueArc::into_arc(new_first));
        h.set(hooks);
    });
}

/// 运行所有钩子。
///
/// 在父线程中调用。
///
/// 返回将在新线程中调用的函数。
pub(super) fn run_spawn_hooks(thread: &Thread) -> ChildSpawnHooks {
    // Get a snapshot of the spawn hooks.
    // (Increments the refcount to the first node.)
    if let Ok(hooks) = SPAWN_HOOKS.try_with(|hooks| {
        let snapshot = hooks.take();
        hooks.set(snapshot.clone());
        snapshot
    }) {
        // Iterate over the hooks, run them, and collect the results in a vector.
        let to_run: Vec<_> = iter::successors(hooks.first.as_deref(), |hook| hook.next.as_deref())
            .map(|hook| (hook.hook)(thread))
            .collect();
        // Pass on the snapshot of the hooks and the results to the new thread,
        // which will then run SpawnHookResults::run().
        ChildSpawnHooks { hooks, to_run }
    } else {
        // TLS has been destroyed. Skip running the hooks.
        // See https://github.com/rust-lang/rust/issues/138696
        ChildSpawnHooks::default()
    }
}

/// 运行钩子的结果。
///
/// 此结构体被传递给新线程。
/// 它包含继承的钩子和要运行的闭包。
#[derive(Default)]
pub(super) struct ChildSpawnHooks {
    hooks: SpawnHooks,
    to_run: Vec<Box<dyn FnOnce() + Send>>,
}

impl ChildSpawnHooks {
    // This is run on the newly spawned thread, directly at the start.
    pub(super) fn inherit_and_run(self) {
        SPAWN_HOOKS.set(self.hooks);
        for run in self.to_run {
            run();
        }
    }
}
