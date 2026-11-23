<a id="expr.await"></a>
# 等待表达式

<a id="expr.await.syntax"></a> 
```grammar,expressions
AwaitExpression -> Expression `.` `await`
```

<a id="expr.await.intro"></a> `await` 表达式是一种语法结构，用于暂停计算过程，由 `std::future::IntoFuture` 的实现提供，直到给定的未来值准备好产生结果。

<a id="expr.await.construct"></a> await 表达式的语法包括一个实现 [`IntoFuture`] trait 的类型表达式，称为 *未来操作数*，接着是 `.` 符号，最后加上 `await` 关键字。

<a id="expr.await.allowed-positions"></a> await 表达式仅在 [异步上下文] 中合法，例如 [`async fn`]、[异步 闭包] 或 [异步 块]。

<a id="expr.await.effects"></a> 更具体地说，await 表达式具有以下效果。

1. 通过调用 `IntoFuture::into_future` 对未来操作数创建未来值。2. 将未来值评估为 [future] `tmp`。3. 使用 [`Pin::new_unchecked`] 固定 `tmp`。4. 然后通过调用 [`Future::poll]` 方法并传入当前的 [任务上下文](#task-context) 来查询这个固定的未来值。5. 如果 `poll` 的调用返回 [`Poll::Pending`，则未来值为 `Poll::Pending`，暂停其状态，以便在重新查询异步上下文时回到步骤 3。6. 否则，`poll` 的调用必须返回 [`Poll::Ready`，在这种情况下，[Poll::Ready] 变体中包含的值作为 `await` 表达式的结果使用。

<a id="expr.await.edition2018"></a> > [!EDITION-2018] > await 表达式仅在 Rust 2018 版本及以后可用。

<a id="expr.await.task"></a>
## 任务上下文

任务上下文指的是在查询异步上下文时提供给当前 [异步上下文] 的 [`Context`]。由于 await 表达式仅在异步上下文中合法，因此必须存在某个任务上下文。

<a id="expr.await.desugar"></a>
## 近似去糖化

实际上，await 表达式大致相当于以下非规范去糖化：

<!-- ignore: example expansion -->
```rust,ignore
match operand.into_future() {
    mut pinned => loop {
        let mut pin = unsafe { Pin::new_unchecked(&mut pinned) };
        match Pin::future::poll(Pin::borrow(&mut pin), &mut current_context) {
            Poll::Ready(r) => break r,
            Poll::Pending => yield Poll::Pending,
        }
    }
}
```

其中，`yield`伪代码返回`Poll::Pending`，当再次调用时，会从该点继续执行。变量`current_context`指的是从异步环境获取的上下文。

[`Context`]: std::task::Context
[`future::poll`]: std::future::Future::poll
[`pin::new_unchecked`]: std::pin::Pin::new_unchecked
[`poll::Pending`]: std::task::Poll::Pending
[`poll::Ready`]: std::task::Poll::Ready
[future]: std::future::Future
[`IntoFuture`]: std::future::IntoFuture
[`IntoFuture::into_future`]: std::future::IntoFuture::into_future

[`async fn`]: ../items/functions.md#async-functions
[`async` closure]: closure-expr.md#async-closures
[`async` block]: block-expr.md#async-blocks
[async context]: ../expressions/block-expr.md#async-context
