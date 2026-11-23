<a id="attributestesting"></a>
# 测试属性

<a id="attributestesting.intro"></a> 以下 [属性] 用于指定执行测试的函数。在“test”模式下编译 crate 可以构建测试函数以及用于执行测试的测试框架。启用测试模式还会启用 [`test` 条件编译选项]。

<!-- template:attributes -->
<a id="attributestesting.test"></a>
## `test` 属性

<a id="attributestesting.test.intro"></a> *`test` [属性][attributes]* 标记一个函数作为测试执行。

> [!EXAMPLE]
> ```rust,no_run
> # pub fn add(left: u64, right: u64) -> u64 { left + right }
> #[test]
> fn it_works() {
>     let result = add(2, 2);
>     assert_eq!(result, 4);
> }
> ```

<a id="attributestesting.test.syntax"></a> `test` 属性使用 [MetaWord] 语法。

<a id="attributestesting.test.allowed-positions"></a> `test` 属性只能应用于单态、不接收参数且返回类型实现 [`Termination`] trait 的 [自由函数]。

> [!NOTE]
> Some of types that implement the [`Termination`] trait include:
> * `()`
> * `Result<T, E> where T: Termination, E: Debug`

<a id="attributestesting.test.duplicates"></a> `test` 在函数上的首次使用才具有效果。

> [!NOTE]
> `rustc` lints against any use following the first. This may become an error in the future.

<!-- TODO: This is a minor lie. Currently rustc warns that duplicates are ignored, but it then generates multiple test entries with the same name. I would vote for rejecting this in the future. -->

<a id="attributestesting.test.stdlib"></a> `test` 属性从标准库前导模块导出为 [`std::prelude::v1::test]`。

<a id="attributestesting.test.enabled"></a> 这些函数在测试模式下才会被编译。

> [!NOTE]
> The test mode is enabled by passing the `--test` argument to `rustc` or using `cargo test`.

<a id="attributestesting.test.success"></a> 测试框架会调用返回值的 [`report`] 方法，并根据产生的 [`ExitCode`] 是否表示成功终止来将测试分类为通过或失败。具体来说：* 只要测试正常终止且不引发恐慌，返回 `()` 的测试即通过。* 只要返回 `Ok(())`，返回 `Result<(), E>` 的测试即通过。* 返回 `ExitCode::SUCCESS` 的测试通过，返回 `ExitCode::FAILURE` 的测试失败。* 既不终止也不通过的测试视为未通过。

> [!EXAMPLE]
> ```rust,no_run
> # use std::io;
> # fn setup_the_thing() -> io::Result<i32> { Ok(1) }
> # fn do_the_thing(s: &i32) -> io::Result<()> { Ok(()) }
> #[test]
> fn test_the_thing() -> io::Result<()> {
>     let state = setup_the_thing()?; // expected to succeed
>     do_the_thing(&state)?;          // expected to succeed
>     Ok(())
> }
> ```

<!-- template:attributes -->
<a id="attributestesting.ignore"></a>
## `ignore` 属性

<a id="attributestesting.ignore.intro"></a> *`ignore` [属性][attributes]* 可以与 [`test` 属性][attributestesting.test] 一起使用，以指示测试框架不要将该函数作为测试执行。

> [!EXAMPLE]
> ```rust,no_run
> #[test]
> #[ignore]
> fn check_thing() {
>     // …
> }
> ```

> [!NOTE]
> The `rustc` test harness supports the `--include-ignored` flag to force ignored tests to be run.

<a id="attributestesting.ignore.syntax"></a> `ignore` 属性使用 [MetaWord] 和 [MetaNameValueStr] 语法。

<a id="attributes.testing.ignore.reason"></a> `ignore` 属性的 [MetaNameValueStr] 形式提供了一种指定测试被忽略原因的方法。

> [!EXAMPLE]
> ```rust,no_run
> #[test]
> #[ignore = "not yet implemented"]
> fn mytest() {
>     // …
> }
> ```

<a id="attributestesting.ignore.allowed-positions"></a> `ignore` 属性只能应用于带有 `test` 属性的函数。

> [!NOTE]
> `rustc` ignores use in other positions but lints against it. This may become an error in the future.

<a id="attributestesting.ignore.duplicates"></a> 在函数中首次使用 `ignore` 才具有效果。

> [!NOTE]
> `rustc` lints against any use following the first. This may become an error in the future.

<a id="attributestesting.ignore.behavior"></a> 在测试模式下被忽略的测试仍然会被编译，但不会被执行。

<!-- template:attributes -->
<a id="attributestesting.should_panic"></a>
## `should_panic` 属性

<a id="attributestesting.should_panic.intro"></a> *`should_panic` [attribute][attributes]* 使得测试仅在应用于的 [test function][attributestesting.test] 发生 panic 时通过。

> [!EXAMPLE]
> ```rust,no_run
> #[test]
> #[should_panic(expected = "values don't match")]
> fn mytest() {
>     assert_eq!(1, 2, "values don't match");
> }
> ```

<a id="attributestesting.should_panic.syntax"></a> `should_panic` 属性有以下形式：

- [MetaWord]
  > [!EXAMPLE]
  > ```rust,no_run
  > #[test]
  > #[should_panic]
  > fn mytest() { panic!("error: some message, and more"); }
  > ```

- [MetaNameValueStr] --- 给定的字符串必须出现在 panic 消息中，测试才能通过。
  > [!EXAMPLE]
  > ```rust,no_run
  > #[test]
  > #[should_panic = "some message"]
  > fn mytest() { panic!("error: some message, and more"); }
  > ```

- [MetaListNameValueStr] --- 与 [MetaNameValueStr] 语法类似，给定的字符串也必须出现在 panic 消息中。
  > [!EXAMPLE]
  > ```rust,no_run
  > #[test]
  > #[should_panic(expected = "some message")]
  > fn mytest() { panic!("error: some message, and more"); }
  > ```

<a id="attributestesting.should_panic.allowed-positions"></a> `should_panic` 属性只能应用于带有 `test` 属性的函数。

> [!NOTE]
> `rustc` ignores use in other positions but lints against it. This may become an error in the future.

<a id="attributestesting.should_panic.duplicates"></a> 在函数中首次使用 `should_panic` 才具有效果。

> [!NOTE]
> `rustc` lints against any use following the first with a future-compatibility warning. This may become an error in the future.

<a id="attributestesting.should_panic.expected"></a> 当使用 [MetaNameValueStr] 形式或带有 `expected` 键的 [MetaListNameValueStr] 形式时，给定的字符串必须出现在 panic 消息中的某个位置，测试才能通过。

<a id="attributestesting.should_panic.return"></a> test 函数的返回类型必须是 `()`。

[`Termination`]: std::process::Termination
[`report`]: std::process::Termination::report
[`ExitCode`]: std::process::ExitCode

[`test` conditional compilation option]: ../conditional-compilation.md#test
[attributes]: ../attributes.md
[free functions]: ../glossary.md#free-item
