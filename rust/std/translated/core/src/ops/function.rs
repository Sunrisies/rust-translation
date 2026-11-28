use crate::marker::Tuple;
use crate::ptr::NonNull;
/// 接受不可变接收者的调用运算符版本。
///
/// Instances of `Fn` can be called repeatedly without mutating state.
///
/// *This trait (`Fn`) is not to be confused with [function pointers]
/// (`fn`).*
///
/// `Fn` is implemented automatically by closures which only take immutable
/// 对捕获变量的引用，或者根本不捕获任何内容
/// 作为（安全的）[函数指针]（有一些注意事项，请参阅其文档
/// for more details). Additionally, for any type `F` that implements `Fn`, `&F`
/// implements `Fn`, too.
///
/// Since both [`FnMut`] and [`FnOnce`] are supertraits of `Fn`, any
/// instance of `Fn` can be used as a parameter where a [`FnMut`] or [`FnOnce`]
/// is expected.
///
/// Use `Fn` as a bound when you want to accept a parameter of function-like
/// 类型，并且需要反复调用而不改变状态（例如，在并发调用时）。如果您不需要如此严格的要求，则使用
/// calling it concurrently). If you do not need such strict requirements, use
/// [`FnMut`] or [`FnOnce`] as bounds.
///
/// 请参阅 *Rust Programming Language* 中的 [关于闭包的章节][书籍]
/// 有关此主题的更多信息。
///
/// Also of note is the special syntax for `Fn` traits (e.g.
/// `Fn(usize, bool) -> usize`). Those interested in the technical details of
/// 可以参考 *Rustonomicon* 中的 [相关部分][nomicon]。
///
/// [book]: ../../book/ch13-01-closures.html
/// [function pointers]: fn
/// [nomicon]: ../../nomicon/hrtb.html
///
/// # 示例
///
/// ## 调用闭包
///
/// ```
/// let square = |x| x * x;
/// assert_eq!(square(5), 25);
/// ```
///
/// ## Using a `Fn` parameter
///
/// ```
/// fn call_with_one<F>(func: F) -> usize
///     where F: Fn(usize) -> usize {
///     func(1)
/// }
///
/// let double = |x| x * 2;
/// assert_eq!(call_with_one(double), 2);
/// ```
#[lang = "fn"]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_paren_sugar]
#[rustc_on_unimplemented(
    on(
        Args = "()",
        note = "wrap the `{Self}` in a closure with no arguments: `|| {{ /* code */ }}`"
    ),
    on(
        Self = "unsafe fn",
        note = "unsafe function cannot be called generically without an unsafe block",
        // SAFETY: tidy is not smart enough to tell that the below unsafe block is a string
        label = "call the function in a closure: `|| unsafe {{ /* code */ }}`"
    ),
    message = "expected `{this:resolved}` signature, found `{Self}`",
    label = "expected `{this:resolved}` signature, found `{Self}`"
)]
#[fundamental] // so that regex can rely that `&str: !FnMut`
#[must_use = "closures are lazy and do nothing unless called"]
#[rustc_const_unstable(feature = "const_trait_impl", issue = "143874")]
pub const trait Fn<Args: Tuple>: [const] FnMut<Args> {
    /// 执行调用操作。
    #[unstable(feature = "fn_traits", issue = "29625")]
    extern "rust-call" fn call(&self, args: Args) -> Self::Output;
}

/// 接受可变接收者的调用运算符版本。
///
/// Instances of `FnMut` can be called repeatedly and may mutate state.
///
/// `FnMut` is implemented automatically by closures which take mutable
/// references to captured variables, as well as all types that implement
/// [`Fn`], e.g., (safe) [function pointers] (since `FnMut` is a supertrait of
/// [`Fn`]). Additionally, for any type `F` that implements `FnMut`, `&mut F`
/// implements `FnMut`, too.
///
/// Since [`FnOnce`] is a supertrait of `FnMut`, any instance of `FnMut` can be
/// used where a [`FnOnce`] is expected, and since [`Fn`] is a subtrait of
/// `FnMut`, any instance of [`Fn`] can be used where `FnMut` is expected.
///
/// Use `FnMut` as a bound when you want to accept a parameter of function-like
/// 类型，并且需要反复调用，同时允许它改变状态。
/// If you don't want the parameter to mutate state, use [`Fn`] as a
/// bound; if you don't need to call it repeatedly, use [`FnOnce`].
///
/// 有关此主题的更多信息，请参阅 [*Rust 编程语言*][book] 中的[闭包章节]。
/// 有关此主题的更多信息，请参阅 [*Rustonomicon*][nomicon] 中的相关部分。
///
/// Also of note is the special syntax for `Fn` traits (e.g.
/// `Fn(usize, bool) -> usize`). Those interested in the technical details of
/// this can refer to [the relevant section in the *Rustonomicon*][nomicon].
///
/// [book]: ../../book/ch13-01-closures.html
/// [function pointers]: fn
/// [nomicon]: ../../nomicon/hrtb.html
///
/// # 示例
///
/// ## 调用可捕获的可变闭包
///
/// ```
/// let mut x = 5;
/// {
///     let mut square_x = || x *= x;
///     square_x();
/// }
/// assert_eq!(x, 25);
/// ```
///
/// ## Using a `FnMut` parameter
///
/// ```
/// fn do_twice<F>(mut func: F)
///     where F: FnMut()
/// {
///     func();
///     func();
/// }
///
/// let mut x: usize = 1;
/// {
///     let add_two_to_x = || x += 2;
///     do_twice(add_two_to_x);
/// }
///
/// assert_eq!(x, 5);
/// ```
#[lang = "fn_mut"]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_paren_sugar]
#[rustc_on_unimplemented(
    on(
        Args = "()",
        note = "wrap the `{Self}` in a closure with no arguments: `|| {{ /* code */ }}`"
    ),
    on(
        Self = "unsafe fn",
        note = "unsafe function cannot be called generically without an unsafe block",
        // SAFETY: tidy is not smart enough to tell that the below unsafe block is a string
        label = "call the function in a closure: `|| unsafe {{ /* code */ }}`"
    ),
    message = "expected `{this:resolved}` signature, found `{Self}`",
    label = "expected `{this:resolved}` signature, found `{Self}`"
)]
#[fundamental] // so that regex can rely that `&str: !FnMut`
#[must_use = "closures are lazy and do nothing unless called"]
#[rustc_const_unstable(feature = "const_trait_impl", issue = "143874")]
pub const trait FnMut<Args: Tuple>: FnOnce<Args> {
    /// 执行调用操作。
    #[unstable(feature = "fn_traits", issue = "29625")]
    extern "rust-call" fn call_mut(&mut self, args: Args) -> Self::Output;
}

/// 接受值传递接收器的调用运算符版本。
///
/// Instances of `FnOnce` can be called, but might not be callable multiple
/// times. Because of this, if the only thing known about a type is that it
/// implements `FnOnce`, it can only be called once.
///
/// `FnOnce` is implemented automatically by closures that might consume captured
/// variables, as well as all types that implement [`FnMut`], e.g., (safe)
/// [function pointers] (since `FnOnce` is a supertrait of [`FnMut`]).
///
/// Since both [`Fn`] and [`FnMut`] are subtraits of `FnOnce`, any instance of
/// [`Fn`] or [`FnMut`] can be used where a `FnOnce` is expected.
///
/// Use `FnOnce` as a bound when you want to accept a parameter of function-like
/// 参见 [*Rustonomicon*][nomicon] 中的相关部分。
/// repeatedly, use [`FnMut`] as a bound; if you also need it to not mutate
/// state, use [`Fn`].
///
/// See the [chapter on closures in *The Rust Programming Language*][book] for
/// 调用运算符后返回的类型的用法。
///
/// Also of note is the special syntax for `Fn` traits (e.g.
/// `Fn(usize, bool) -> usize`). Those interested in the technical details of
/// this can refer to [the relevant section in the *Rustonomicon*][nomicon].
///
/// [book]: ../../book/ch13-01-closures.html
/// [function pointers]: fn
/// [nomicon]: ../../nomicon/hrtb.html
///
/// # 示例
///
/// ## Using a `FnOnce` parameter
///
/// ```
/// fn consume_with_relish<F>(func: F)
///     where F: FnOnce() -> String
/// {
///     // `func` consumes its captured variables, so it cannot be run more
///     // than once.
///     println!("Consumed: {}", func());
///
///     println!("Delicious!");
///
///     // Attempting to invoke `func()` again will throw a `use of moved
///     // value` error for `func`.
/// }
///
/// let x = String::from("x");
/// let consume_and_return_x = move || x;
/// consume_with_relish(consume_and_return_x);
///
/// // `consume_and_return_x` can no longer be invoked at this point
/// ```
#[lang = "fn_once"]
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_paren_sugar]
#[rustc_on_unimplemented(
    on(
        Args = "()",
        note = "wrap the `{Self}` in a closure with no arguments: `|| {{ /* code */ }}`"
    ),
    on(
        Self = "unsafe fn",
        note = "unsafe function cannot be called generically without an unsafe block",
        // SAFETY: tidy is not smart enough to tell that the below unsafe block is a string
        label = "call the function in a closure: `|| unsafe {{ /* code */ }}`"
    ),
    message = "expected `{this:resolved}` signature, found `{Self}`",
    label = "expected `{this:resolved}` signature, found `{Self}`"
)]
#[fundamental] // so that regex can rely that `&str: !FnMut`
#[must_use = "closures are lazy and do nothing unless called"]
#[rustc_const_unstable(feature = "const_trait_impl", issue = "143874")]
pub const trait FnOnce<Args: Tuple> {
    /// 调用运算符后返回的类型的用法。
    #[lang = "fn_once_output"]
    #[stable(feature = "fn_once_output", since = "1.12.0")]
    type Output;

    /// 执行调用操作。
    #[unstable(feature = "fn_traits", issue = "29625")]
    extern "rust-call" fn call_once(self, args: Args) -> Self::Output;
}

mod impls {
    use crate::marker::Tuple;

    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_trait_impl", issue = "143874")]
    const impl<A: Tuple, F: ?Sized> Fn<A> for &F
    where
        F: [const] Fn<A>,
    {
        extern "rust-call" fn call(&self, args: A) -> F::Output {
            (**self).call(args)
        }
    }

    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_trait_impl", issue = "143874")]
    const impl<A: Tuple, F: ?Sized> FnMut<A> for &F
    where
        F: [const] Fn<A>,
    {
        extern "rust-call" fn call_mut(&mut self, args: A) -> F::Output {
            (**self).call(args)
        }
    }

    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_trait_impl", issue = "143874")]
    const impl<A: Tuple, F: ?Sized> FnOnce<A> for &F
    where
        F: [const] Fn<A>,
    {
        type Output = F::Output;

        extern "rust-call" fn call_once(self, args: A) -> F::Output {
            (*self).call(args)
        }
    }

    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_trait_impl", issue = "143874")]
    const impl<A: Tuple, F: ?Sized> FnMut<A> for &mut F
    where
        F: [const] FnMut<A>,
    {
        extern "rust-call" fn call_mut(&mut self, args: A) -> F::Output {
            (*self).call_mut(args)
        }
    }

    #[stable(feature = "rust1", since = "1.0.0")]
    #[rustc_const_unstable(feature = "const_trait_impl", issue = "143874")]
    const impl<A: Tuple, F: ?Sized> FnOnce<A> for &mut F
    where
        F: [const] FnMut<A>,
    {
        type Output = F::Output;
        extern "rust-call" fn call_once(self, args: A) -> F::Output {
            (*self).call_mut(args)
        }
    }
}

unsafe extern "C" {
    /// 表示函数机器码的类型。
    ///
    /// 指向此类型的指针类似于 [函数指针][fn]，
    /// 但不指定函数的签名或 ABI，无法用于
    /// 从安全代码调用该函数。
    ///
    /// Pointers to this type may be obtained using the [`FnPtr`] trait.
    #[unstable(feature = "fn_static", issue = "148768")]
    #[lang = "code"]
    pub type Code;
}

/// 所有函数指针和函数定义类型都实现的常见特质
#[unstable(feature = "fn_static", issue = "148768")]
#[lang = "fn_addr_trait"]
#[rustc_deny_explicit_impl]
#[rustc_dyn_incompatible_trait]
pub unsafe trait FnAddr: Copy {
    /// 返回函数指针的地址。
    #[unstable(feature = "fn_static", issue = "148768")]
    #[lang = "fn_addr_addr_fn"]
    fn addr(self) -> usize {
        self.as_ptr().addr().get()
    }

    /// Returns the function pointer as a [`NonNull<Code>`].
    #[unstable(feature = "fn_static", issue = "148768")]
    #[lang = "fn_addr_as_ptr"]
    fn as_ptr(self) -> NonNull<Code>;
}

/// 所有函数指针都实现的通用 trait。
#[unstable(feature = "fn_static", issue = "148768")]
#[lang = "fn_ptr_trait"]
#[fundamental]
#[rustc_deny_explicit_impl]
#[rustc_dyn_incompatible_trait]
pub unsafe trait FnPtr: FnAddr {
    /// Constructs a function pointer from a `NonNull` pointer.
    ///
    /// # 安全性
    ///
    /// 函数指针必须来自
    /// from an [`FnAddr::as_ptr`] call from a function
    /// 与 ABI 兼容的指针类型。
    #[unstable(feature = "fn_static", issue = "148768")]
    #[lang = "fn_ptr_from_ptr"]
    unsafe fn from_ptr(ptr: NonNull<Code>) -> Self;
}
