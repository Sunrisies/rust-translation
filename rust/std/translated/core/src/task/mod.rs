#![stable(feature = "futures_api", since = "1.36.0")]

//! 用于处理异步任务的类型与 trait。

mod poll;
#[stable(feature = "futures_api", since = "1.36.0")]
pub use self::poll::Poll;

mod wake;
#[stable(feature = "futures_api", since = "1.36.0")]
pub use self::wake::{Context, ContextBuilder, LocalWaker, RawWaker, RawWakerVTable, Waker};

mod ready;
#[stable(feature = "ready_macro", since = "1.64.0")]
pub use ready::ready;
