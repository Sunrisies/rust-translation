# Testing

开发 Clippy 的 lints 采用测试驱动开发（TDD）流程，因为在实现新 lints 的逻辑之前，我们的首要任务是编写一些测试用例。

## 通过测试开发 lints

在开发 Clippy 时，我们进入了一个复杂且混乱的领域，其中存在编程问题、风格错误、不合逻辑的代码以及不符合规范的情况。测试是我们能够利用的第一层秩序，用于确定何时何地触发新 lints。

此外，先编写测试用例有助于 Clippy 开发者在第一次迭代及后续改进中找到平衡。有了测试用例后，我们就不必担心在第一个版本上过度设计 lints，也不会错过 lints 的一些明显边缘情况。这种方法使我们能够逐步改进每个 lints。

## Clippy UI 测试

我们在 Clippy 中使用 **UI 测试**来进行验证。这些 UI 测试确保 Clippy 的输出符合我们的预期。每个测试只是一个包含我们要检查的代码的普通 Rust 文件。

Clippy 的输出与 `.stderr` 文件进行比对。请注意，您无需自己创建此文件。我们将使用命令 [`cargo bless`](#cargo-bless) 来生成 `.stderr` 文件（详见后文）。

### 编写测试用例

现在让我们思考一些针对假想的 `foo_functions` lints 的测试。我们首先打开由 `cargo dev new_lint` 创建的测试文件 `tests/ui/foo_functions.rs`。

用一些示例更新文件以开始使用：

```rust
#![warn(clippy::foo_functions)] // < Add this, so the lint is guaranteed to be enabled in this file

// Impl methods
struct A;
impl A {
    pub fn fo(&self) {}
    pub fn foo(&self) {}
    //~^ foo_functions
    pub fn food(&self) {}
}

// Default trait methods
trait B {
    fn fo(&self) {}
    fn foo(&self) {}
    //~^ foo_functions
    fn food(&self) {}
}

// Plain functions
fn fo() {}
fn foo() {}
//~^ foo_functions
fn food() {}

fn main() {
    // We also don't want to lint method calls
    foo();
    let a = A;
    a.foo();
}
```

如果没有实际的 lints 逻辑在看到 `foo` 函数名称时发出警告，这个测试将会失败，因为我们在标记为 `//~^ foo_functions` 的行处预期会有错误。然而，我们现在可以使用以下命令运行测试：

```sh
$ TESTNAME=foo_functions cargo uitest
```

Clippy 会编译出来，但会报错称没有收到任何错误：

```
...Clippy warnings and test outputs...
error: diagnostic code `clippy::foo_functions` not found on line 8
 --> tests/ui/foo_functions.rs:9:10
  |
9 |     //~^ foo_functions
  |          ^^^^^^^^^^^^^ expected because of this pattern
  |

error: diagnostic code `clippy::foo_functions` not found on line 16
  --> tests/ui/foo_functions.rs:17:10
   |
17 |     //~^ foo_functions
   |          ^^^^^^^^^^^^^ expected because of this pattern
   |

error: diagnostic code `clippy::foo_functions` not found on line 23
  --> tests/ui/foo_functions.rs:24:6
   |
24 | //~^ foo_functions
   |      ^^^^^^^^^^^^^ expected because of this pattern
   |

```

这是正常的。毕竟，我们编写了大量的 Rust 代码，但实际上并没有实现任何逻辑让 Clippy 检测 `foo` 函数并发出警告。

随着我们逐步实施 lint 逻辑，我们将持续运行此 UI 测试命令。Clippy 将开始输出信息，以便我们检查输出是否符合预期。

### 测试用例命名

为每个测试函数赋予一个明确说明其功能的名称。如果测试来自某个问题，请在上方评论中注明问题编号：

```rust
// #1XXXX: the receiver is a macro argument, so the suggestion must not cut through `id!(..)`
fn dont_cut_through_macro_call() {
    // ...
}
```

像 `fn issue1XXXX()` 这样的命名方式会迫使执行测试的人在发现问题之前先查找该问题。许多现有测试采用这种命名方式，但新测试和测试文件应使用更具描述性的名称。Rustc-dev-guide 中有更多关于[测试用例命名]的内容。


### 示例输出

当我们的 `foo_functions` lint 被测试时，输出可能如下所示：

```
failures:
---- compile_test stdout ----
normalized stderr:
error: function called "foo"
  --> tests/ui/foo_functions.rs:6:12
   |
LL |     pub fn foo(&self) {}
   |            ^^^
   |
   = note: `-D clippy::foo-functions` implied by `-D warnings`
error: function called "foo"
  --> tests/ui/foo_functions.rs:13:8
   |
LL |     fn foo(&self) {}
   |        ^^^
error: function called "foo"
  --> tests/ui/foo_functions.rs:19:4
   |
LL | fn foo() {}
   |    ^^^
error: aborting due to 3 previous errors
```

请注意片段顶部的 *failures* 标签，我们将在下一节中删除它（保存此输出）。

> [!NOTE] > 可以通过指定逗号分隔的列表来运行多个测试文件：> `TESTNAME=foo_functions,bar_methods,baz_structs`。

### `cargo bless`

一旦对输出感到满意，我们需要运行此命令以生成或更新我们的 lint 对应的 `.stderr` 文件：

```sh
$ TESTNAME=foo_functions cargo uibless
```

该命令将生成的 lint 建议和修复内容写入 `.stderr` 文件，其中包含 lint 的原因、建议的修复方案以及行号等信息。

此时运行 `TESTNAME=foo_functions cargo uitest` 应该会通过。当我们提交 lint 结果时，也需要提交生成的 `.stderr` 文件。

通常，您只应提交由 `cargo bless` 更改的文件，用于创建或编辑特定的 lint。

> [!NOTE] > 如果生成的 `.stderr` 和 `.fixed` 文件为空，则应该将其删除。

## `toml` 测试

某些 lint 可以通过 `clippy.toml` 文件进行配置。这些配置值在 `tests/ui-toml` 中受到测试。

要在其中添加新测试，请创建新目录并添加相关文件：

- `clippy.toml`: 在此处输入您想要测试的配置值。 - `lint_name.rs`: 一个测试文件，您在其中放置测试代码，根据 `clippy.toml` 文件中设置的配置，该文件应显示不同的 lint 行为。

潜在的 `.stderr` 和 `.fixed` 文件可以通过 `cargo bless` 再次生成。

## Cargo Lints

Cargo lints 的测试过程与之前不同，因为现在我们关注 `Cargo.toml` 清单文件。在这种情况下，还需要与该清单相关联的一个最小 crate。这些测试在 `tests/ui-cargo` 中生成。

假设我们有一个名为 `foo_categories` 的新示例 lint，我们可以运行：

```sh
$ cargo dev new_lint --name=foo_categories --pass=late --category=cargo
```

运行 `cargo dev new_lint` 后，默认会发现两个新的 crate，每个都包含其清单文件：

* `tests/ui-cargo/foo_categories/fail/Cargo.toml`: 此文件应导致新 lint 引发错误。 * `tests/ui-cargo/foo_categories/pass/Cargo.toml`: 此文件不应触发 lint。

如果您需要更多用例，可以复制其中一个 crate（位于 `foo_categories` 下）并重新命名它。

生成 `.stderr` 文件的过程与其他 lints 相同，在 `cargo uitest` 前添加 `TESTNAME` 变量也适用于 Cargo lints。

## Rustfix Tests

如果您正在处理的 lint 使用结构化建议， [`rustfix`] 会将 lint 的建议应用于测试文件代码，并将其与 `.fixed` 文件的内容进行比较。

结构化建议告诉用户如何修复或重写那些通过 [`span_lint_and_sugg`] 进行 lint 的特定代码。

如果 `span_lint_and_sugg` 用于生成建议，但并非所有建议都能产生有效的代码，可以在测试文件顶部添加 `//@no-rustfix` 注释，以阻止对该文件执行 `rustfix`。

我们将在[后续章节](emitting_lints.md)更深入地讨论建议。

使用 `cargo bless` 可在运行测试后自动生成 `.fixed` 文件。


## 手动测试

如果您添加了一些 `println!` 代码，导致测试套件的输出难以阅读，那么针对示例文件进行手动测试可能会很有帮助。

要使用本地修改尝试使用 Clippy，请从工作副本的根目录运行。

```sh
$ cargo dev lint input.rs
```

[naming tests]: https://rustc-dev-guide.rust-lang.org/tests/best-practices.html#test-naming
[`rustfix`]: https://github.com/rust-lang/cargo/tree/main/crates/rustfix
[`span_lint_and_sugg`]: https://doc.rust-lang.org/beta/nightly-rustc/clippy_utils/diagnostics/fn.span_lint_and_sugg.html
