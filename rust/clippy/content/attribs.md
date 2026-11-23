# crate 作者属性

在某些情况下，可以将 Clippy 的覆盖范围扩展到第三方库。为此，Clippy 提供了一些可以应用于第三方 crate 中项目的属性。

## `#[clippy::format_args]`

_自 Clippy v1.85 版本起可用_

此属性可以添加到支持 `format!`、`println!` 或类似语法的宏上。它告诉 Clippy，该宏是一个格式化宏，且该宏的参数应像 `format!` 的参数一样进行 lint 检查。任何适用于 `format!` 调用的 lint 规则也适用于该宏调用。该宏在格式字符串之前可能还有额外的参数，这些参数将被忽略。

### Example

```rust
/// A macro that prints a message if a condition is true.
#[macro_export]
#[clippy::format_args]
macro_rules! print_if {
    ($condition:expr, $($args:tt)+) => {{
        if $condition {
            println!($($args)+)
        }
    }};
}
```

## `#[clippy::has_significant_drop]`

_自 Clippy v1.60 版本起可用_

`clippy::has_significant_drop` 属性可以添加到那些 `Drop` 实现 具有重要副作用的类型上，例如解锁互斥锁，这要求用户能够准确理解它们的生命周期。当在 match scrutinee 中的函数调用中返回临时对象时，其生命周期持续到匹配块的结束，这可能会让人感到意外。

### Example

```rust
#[clippy::has_significant_drop]
struct CounterWrapper<'a> {
    counter: &'a Counter,
}

impl<'a> Drop for CounterWrapper<'a> {
    fn drop(&mut self) {
        self.counter.i.fetch_sub(1, Ordering::Relaxed);
    }
}
```
