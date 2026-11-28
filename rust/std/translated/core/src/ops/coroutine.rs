use crate::pin::Pin;

/// 协程恢复的结果。
///
/// This enum is returned from the `Coroutine::resume` method and indicates the
/// 协程可能的返回值。目前这对应于
/// a suspension point (`Yielded`) or a termination point (`Complete`).
#[derive(Clone, Copy, PartialEq, PartialOrd, Eq, Ord, Debug, Hash)]
#[lang = "coroutine_state"]
#[unstable(feature = "coroutine_trait", issue = "43122")]
pub enum CoroutineState<Y, R> {
    /// 以值方式暂停的协程。
    ///
    /// 此状态表示协程已暂停，通常
    /// corresponds to a `yield` statement. The value provided in this variant
    /// corresponds to the expression passed to `yield` and allows coroutines to
    /// 每次 yield 时提供一个值。
    Yielded(Y),

    /// 协程以返回值完成。
    ///
    /// This state indicates that a coroutine has finished execution with the
    /// provided value. Once a coroutine has returned `Complete` it is
    /// considered a programmer error to call `resume` again.
    Complete(R),
}

/// 目前，协程是 Rust 中的
///
/// 实验性语言特性。在 [RFC 2033] 中添加了协程，
/// 目前主要用于提供 async/await 语法的基础结构，但未来可能会扩展到为
/// 迭代器和其他基本类型提供更人性化的定义。
/// 协程的语法和语义不稳定，需要进一步的 RFC 来稳定。不过目前该语法
/// 类似闭包：
///
/// 更多关于协程的文档可以在 [不稳定的手册] 中找到。
/// 此协程返回的数值类型。
/// closure-like:
///
/// ```rust
/// #![feature(coroutines)]
/// #![feature(coroutine_trait)]
/// #![feature(stmt_expr_attributes)]
///
/// use std::ops::{Coroutine, CoroutineState};
/// use std::pin::Pin;
///
/// fn main() {
///     let mut coroutine = #[coroutine] || {
///         yield 1;
///         "foo"
///     };
///
///     match Pin::new(&mut coroutine).resume(()) {
///         CoroutineState::Yielded(1) => {}
///         _ => panic!("unexpected return from resume"),
///     }
///     match Pin::new(&mut coroutine).resume(()) {
///         CoroutineState::Complete("foo") => {}
///         _ => panic!("unexpected return from resume"),
///     }
/// }
/// ```
///
/// 值。例如，将迭代器作为协程使用时，其类型即为
///
/// [RFC 2033]: https://github.com/rust-lang/rfcs/pull/2033
/// [unstable book]: ../../unstable-book/language-features/coroutines.html
#[lang = "coroutine"]
#[unstable(feature = "coroutine_trait", issue = "43122")]
#[fundamental]
#[must_use = "coroutines are lazy and do nothing unless resumed"]
pub trait Coroutine<R = ()> {
    /// The type of value this coroutine yields.
    ///
    /// This associated type corresponds to the `yield` expression and the
    /// values which are allowed to be returned each time a coroutine yields.
    /// For example an iterator-as-a-coroutine would likely have this type as
    /// `T`, the type being iterated over.
    #[lang = "coroutine_yield"]
    type Yield;

    /// 恢复该协程的执行。
    ///
    /// 此函数将恢复协程的执行，或如果尚未执行则开始执行。此调用将返回到协程的
    /// `return` statement or implicitly as the last expression of a coroutine
    /// literal. For example futures would use this as `Result<T, E>` as it
    /// represents a completed future.
    #[lang = "coroutine_return"]
    type Return;

    /// Resumes the execution of this coroutine.
    ///
    /// This function will resume execution of the coroutine or start execution
    /// if it hasn't already. This call will return back into the coroutine's
    /// last suspension point, resuming execution from the latest `yield`. The
    /// coroutine will continue executing until it either yields or returns, at
    /// which point this function will return.
    ///
    /// # 返回值
    ///
    /// The `CoroutineState` enum returned from this function indicates what
    /// state the coroutine is in upon returning. If the `Yielded` variant is
    /// 则表明协程已到达暂停点，并有一个值被输出。
    /// 已传递出去。处于此状态的协程可以在
    /// 稍后重新启动时使用。
    ///
    /// If `Complete` is returned then the coroutine has completely finished
    /// 并提供了所提供的值。协程无法再次被重新启动。
    /// 
    ///
    /// # Panic
    ///
    /// This function may panic if it is called after the `Complete` variant has
    /// been returned previously. While coroutine literals in the language are
    /// guaranteed to panic on resuming after `Complete`, this is not guaranteed
    /// for all implementations of the `Coroutine` trait.
    #[lang = "coroutine_resume"]
    fn resume(self: Pin<&mut Self>, arg: R) -> CoroutineState<Self::Yield, Self::Return>;
}

#[unstable(feature = "coroutine_trait", issue = "43122")]
impl<G: ?Sized + Coroutine<R>, R> Coroutine<R> for Pin<&mut G> {
    type Yield = G::Yield;
    type Return = G::Return;

    fn resume(mut self: Pin<&mut Self>, arg: R) -> CoroutineState<Self::Yield, Self::Return> {
        G::resume((*self).as_mut(), arg)
    }
}

#[unstable(feature = "coroutine_trait", issue = "43122")]
impl<G: ?Sized + Coroutine<R> + Unpin, R> Coroutine<R> for &mut G {
    type Yield = G::Yield;
    type Return = G::Return;

    fn resume(mut self: Pin<&mut Self>, arg: R) -> CoroutineState<Self::Yield, Self::Return> {
        G::resume(Pin::new(&mut *self), arg)
    }
}
