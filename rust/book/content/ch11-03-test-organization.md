## 测试组织

正如本章开头所提到的，测试是一门复杂的学科，不同的人使用不同的术语和组织方式。Rust 社区将测试分为两大类：单元测试和集成测试。_单元测试_规模较小且更聚焦，每次只独立测试一个模块，可以测试私有接口。_集成测试_完全独立于你的库，以与其他外部代码相同的方式使用你的代码，仅使用公共接口，并且可能同时测试多个模块。

编写这两种类型的测试非常重要，以确保库的各个部分单独和一起都能按预期工作。

### 单元测试

单元测试的目的是将每个代码单元与其余代码隔离进行测试，以便快速确定代码在何处按预期运行或未运行。你将在 `_src` 目录中的每个文件中放入单元测试所涉及的代码。惯例是在每个文件创建一个名为 `tests` 的模块来包含测试函数，并使用 `cfg(test)` 注释该模块。

#### `tests` 模块和 `#[cfg(test)]`

在 `tests` 模块上使用 `#[cfg(test)]` 注释告诉 Rust，只有在运行 `cargo test` 时才会编译和运行测试代码，而不是在运行 `cargo build` 时。这样当你只想构建库时就能节省编译时间，并且生成的编译产物中不会包含测试代码，从而节省空间。你会看到由于集成测试位于不同的目录中，因此不需要 `#[cfg(test)]` 注释。然而，由于单元测试与代码放在同一文件中，你需要使用 `#[cfg(test)]` 来指定它们不应被包含在编译结果中。

回想一下，在本章的第一部分生成新的 `adder` 项目时，Cargo 为我们生成了这些代码：

<span class="filename">Filename: src/lib.rs</span>

```rust,noplayground
{{#rustdoc_include ../listings/ch11-writing-automated-tests/listing-11-01/src/lib.rs}}
```

在自动生成的 `tests` 模块中，属性 `cfg` 代表_配置_，用于告诉 Rust：只有在特定配置选项存在时，以下项才应被包含。在这种情况下，配置选项是 `test`，由 Rust 提供以编译和运行测试。通过使用 `cfg` 属性，只有当我们主动使用 `cargo test` 运行测试时，Cargo 才会编译我们的测试代码。这包括该模块中的任何辅助函数，以及带有 `#[test]` 注释的函数。

<!-- Old headings. Do not remove or links may break. -->

<a id="testing-private-functions"></a>

#### 私有函数测试

测试社区中存在关于是否应直接测试私有函数的争论，其他语言则使得测试私有函数变得困难或不可能。无论你遵循哪种测试理念，Rust 的隐私规则都允许你测试私有函数。请参考列表 11-12 中的代码，其中包含私有函数 `internal_adder`。

<Listing number="11-12" file-name="src/lib.rs" caption="Testing a private function">

```rust,noplayground
{{#rustdoc_include ../listings/ch11-writing-automated-tests/listing-11-12/src/lib.rs}}
```

</Listing>

请注意，`internal_adder` 函数未被标记为 `pub`。测试只是 Rust 代码，而 `tests` 模块也只是另一个模块。正如我们在[“在模块树中引用项的路径”][paths]<!-- ignore -->中讨论的，子模块中的项可以使用其祖先模块中的项。在这个测试中，我们通过 `use super::*` 将 `tests` 模块的父模块中的所有项引入作用域，然后测试可以调用 `internal_adder`。如果你认为不应测试私有函数，Rust 中没有任何东西强迫你这样做。

### 集成测试

在 Rust 中，集成测试完全独立于你的库。它们以与其他代码相同的方式使用你的库，这意味着它们只能调用属于库公共 API 的函数。其目的是测试库的许多部分是否能够正确协同工作。单独运行时正确的代码单元在集成后可能会出现问题，因此集成代码的测试覆盖率也很重要。要创建集成测试，你首先需要一个 `_tests_` 目录。

#### `_tests_` 目录

我们在项目目录的顶层创建一个 `_tests_` 目录，位于 `_src_` 旁边。Cargo 知道会在该目录中查找集成测试文件。然后我们可以创建任意多的测试文件，Cargo 会将每个文件编译为独立的库。

让我们创建一个集成测试。将列表 11-12 中的代码保留在 `_src/lib.rs` 文件中，然后创建 `_tests_` 目录，并新建一个名为 `_tests/integration_test.rs` 的文件。你的目录结构应该如下所示：

```text
adder
├── Cargo.lock
├── Cargo.toml
├── src
│   └── lib.rs
└── tests
    └── integration_test.rs
```

将列表 11-13 中的代码写入 `_tests/integration_test.rs` 文件。

<Listing number="11-13" file-name="tests/integration_test.rs" caption="An integration test of a function in the `adder` crate">

```rust,ignore
{{#rustdoc_include ../listings/ch11-writing-automated-tests/listing-11-13/tests/integration_test.rs}}
```

</Listing>

`_tests_` 目录中的每个文件都是一个独立的库，因此我们需要将我们的库引入每个测试库的作用域中。为此，我们在代码顶部添加 `use adder::add_two;`，而在单元测试中并不需要这一行代码。

我们不需要在 `_tests/integration_test.rs` 中对任何代码标注 `#[cfg(test)]`。Cargo 对 `_tests_` 目录有特殊处理，只有在运行 `cargo test` 时才会编译该目录中的文件。现在运行 `cargo test`：

```console
{{#include ../listings/ch11-writing-automated-tests/listing-11-13/output.txt}}
```

输出的三个部分包括单元测试、集成测试和文档测试。请注意，如果某个部分的任何测试失败，其他部分将不会运行。例如，如果一个单元测试失败，则集成测试和文档测试将没有输出，因为这些测试只有在所有单元测试都通过时才会运行。

单元测试的第一个部分与之前相同：每个单元测试对应一行代码（我们在列表 11-12 中添加了名为 `internal` 的一行），然后是对单元测试的总结行。

集成测试部分以 `Running tests/integration_test.rs` 这一行开始。接下来是该集成测试中每个测试函数的行，以及集成测试结果的总结行，就在 `Doc-tests adder` 部分之前。

每个集成测试文件都有自己独立的章节，因此如果我们在 `_tests_` 目录中添加更多文件，就会出现更多的集成测试章节。

我们仍然可以通过将测试函数的名称作为参数传递给 `cargo test` 来运行特定的集成测试函数。要运行特定集成测试文件中的所有测试，请使用 `cargo test` 的 `--test` 参数后跟该文件的名称：

```console
{{#include ../listings/ch11-writing-automated-tests/output-only-05-single-integration/output.txt}}
```

此命令仅运行 _tests/integration_test.rs_ 文件中的测试。

#### 集成测试中的子模块

随着我们添加更多的集成测试，可能需要在 _tests_ 目录中创建更多文件以辅助组织；例如，可以根据测试的功能将测试函数分组。如前所述，_tests_ 目录中的每个文件都会作为独立的 crate 编译，这有助于创建不同的作用域，从而更真实地模拟最终用户使用你的 crate 的方式。但是这意味着 _tests_ 目录中的文件不会像 _src_ 中的文件那样具有相同的行为，正如你在第7章中学习的如何将代码拆分为模块和文件的做法。

当您有一组辅助函数需要在多个集成测试文件中使用，并且试图按照第7章的“将模块拆分为不同文件”部分中的步骤将它们提取到一个公共模块中时，_tests_ 目录中文件的不同行为就会非常明显。例如，如果我们创建 _tests/common.rs_ 并将一个名为 `setup` 的函数放入其中，我们可以向 `setup` 中添加一些代码，这些代码需要在多个测试文件和多个测试函数中被调用：

<span class="filename">Filename: tests/common.rs</span>

```rust,noplayground
{{#rustdoc_include ../listings/ch11-writing-automated-tests/no-listing-12-shared-test-code-problem/tests/common.rs}}
```

当我们再次运行测试时，我们会看到 _common.rs_ 文件的测试输出中出现了新的部分，尽管该文件不包含任何测试函数，我们也从未从任何地方调用过 `setup` 函数：

```console
{{#include ../listings/ch11-writing-automated-tests/no-listing-12-shared-test-code-problem/output.txt}}
```

我们希望的是让 `common` 出现在测试结果中，并显示“正在运行0个测试”，而不是这样。我们只是想与其他集成测试文件共享一些代码。为了避免 `common` 出现在测试输出中，我们不会创建 _tests/common.rs_，而是会创建 _tests/common/mod.rs_。项目目录现在看起来如下：

```text
├── Cargo.lock
├── Cargo.toml
├── src
│   └── lib.rs
└── tests
    ├── common
    │   └── mod.rs
    └── integration_test.rs
```

这是我们在第7章的“替代文件路径”中提到的旧命名规范。以这种方式命名文件可以告诉Rust不要将`common`模块视为集成测试文件。当我们把`setup`函数代码移动到`_tests/common/mod.rs_`并删除`_tests/common.rs_`文件后，测试输出中的该部分将不再出现。`_tests`目录下的子目录中的文件不会作为独立的crate编译，也不会在测试输出中显示相关部分。

创建 `_tests/common/mod.rs_`后，我们可以从任何集成测试文件中将其作为模块使用。以下是从`_tests/integration_test.rs_`的`it_adds_two`测试中调用`setup`函数的示例：

<span class="filename">Filename: tests/integration_test.rs</span>

```rust,ignore
{{#rustdoc_include ../listings/ch11-writing-automated-tests/no-listing-13-fix-shared-test-code-problem/tests/integration_test.rs}}
```

请注意，`mod common;`声明与我们在列表7-21中演示的模块声明相同。然后，在测试函数中，我们可以调用`common::setup()`函数。

#### 二进制crate的集成测试

如果我们的项目是一个仅包含`_src/main.rs_`文件而不包含`_src/lib.rs_`文件的二进制crate，则无法在 `_tests` 目录中创建集成测试，也无法通过`use`语句将`_src/main.rs`文件中定义的函数引入作用域。只有库crate才会暴露其他crate可以使用的函数；二进制crate旨在独立运行。

这就是提供二进制文件的Rust项目具有简单的`_src/main.rs`文件并调用位于`_src/lib.rs`中的逻辑的原因。利用这种结构，集成测试可以通过`use`语句测试库crate，从而使重要功能可用。如果重要功能正常工作，那么`_src/main.rs`文件中的少量代码也会正常工作，而这部分少量代码不需要进行测试。

## 总结

Rust 的测试功能提供了一种方式来指定代码应如何运行，以确保即使在进行更改时也能按预期工作。单元测试可以单独测试库的不同部分，并能够验证私有的实现细节。集成测试则检查库的多个部分是否协同工作正确，它们使用库的公共 API 来测试代码，就像外部代码使用它一样。尽管 Rust 的类型系统和所有权规则有助于防止某些类型的错误，但测试仍然对于减少与代码预期行为相关的逻辑错误非常重要。

让我们结合本章及之前章节中学到的知识来开展一个项目吧！

[paths]: ch07-03-paths-for-referring-to-an-item-in-the-module-tree.html
[separating-modules-into-files]: ch07-05-separating-modules-into-different-files.html
[alt-paths]: ch07-05-separating-modules-into-different-files.html#alternate-file-paths
