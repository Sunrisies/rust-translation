//! 用于将类型转换为unsafe绑定器及反之的运算符。

/// 将unsafe绑定器解包为其基础类型。
#[allow_internal_unstable(internal_syntax)]
#[unstable(feature = "unsafe_binders", issue = "130516")]
#[diagnostic::opaque]
pub macro unwrap_binder($expr:expr $( ; $ty:ty )?) {
    k#unwrap_binder($expr $( , $ty )?)
}

/// 将类型包装为unsafe绑定器。
#[allow_internal_unstable(internal_syntax)]
#[unstable(feature = "unsafe_binders", issue = "130516")]
#[diagnostic::opaque]
pub macro wrap_binder($expr:expr $( ; $ty:ty )?) {
    k#wrap_binder($expr $( , $ty )?)
}
