## Cargo Workspaces

在第12章中，我们构建了一个包含二进制 crate 和库 crate 的包。随着项目的发展，你可能会发现库 crate 变得越来越大，因此希望将包进一步拆分为多个库 crate。Cargo 提供了名为 _workspaces_ 的功能，可以帮助管理同时开发的多个相关包。

### 创建 Workspace

_Workspace_ 是一组共享同一 `_Cargo.lock_` 和输出目录的包。让我们使用 Workspace 来创建一个项目——我们将使用简单的代码，以便专注于 Workspace 的结构。有多种方式可以构建 Workspace，这里只展示一种常见方法。我们将有一个包含二进制程序和两个库的 Workspace。提供主要功能的二进制程序将依赖这两个库。一个库提供 `add_one` 函数，另一个库提供 `add_two` 函数。这三个 crate 属于同一个 Workspace。首先，我们为 Workspace 创建一个新目录：

```console
$ mkdir add
$ cd add
```

接下来，在 `_add_` 目录中，我们创建 `_Cargo.toml` 文件来配置整个 Workspace。该文件中不会包含 `[package]` 部分。相反，它将以 `[workspace]` 部分开始，这允许我们将成员添加到 Workspace 中。我们还特意将 Workspace 中的 `resolver` 值设置为 `"3"`，以使用 Cargo 最新版本的解析器算法：

<span class="filename">Filename: Cargo.toml</span>

```toml
{{#include ../listings/ch14-more-about-cargo/no-listing-01-workspace/add/Cargo.toml}}
```

然后，我们在 `_add_` 目录中运行 `cargo new` 来创建 `adder` 二进制 crate：

<!-- manual-regeneration
cd listings/ch14-more-about-cargo/output-only-01-adder-crate/add remove `members = ["adder"]` from Cargo.toml rm -rf adder cargo new adder copy output below -->

```console
$ cargo new adder
     Created binary (application) `adder` package
      Adding `adder` as member of workspace at `file:///projects/add`
```

在 Workspace 中运行 `cargo new` 也会自动将新创建的包添加到 `[workspace]` 定义中的 `members` 键中，例如：

```toml
{{#include ../listings/ch14-more-about-cargo/output-only-01-adder-crate/add/Cargo.toml}}
```

此时，我们可以通过运行 `cargo build` 来构建 Workspace。你的 `_add_` 目录中的文件应该看起来像这样：

```text
├── Cargo.lock
├── Cargo.toml
├── adder
│   ├── Cargo.toml
│   └── src
│       └── main.rs
└── target
```

工作区在顶层有一个 _target_ 目录，编译后的工件将放置在此处；而 `adder` 包没有自己的 _target_ 目录。即使我们在 `_adder_` 目录内运行 `cargo build`，编译后的工件仍然会位于 _add/target_ 而不是 _add/adder/target_。Cargo 这样在工作区中构建 _target_ 目录，是因为工作区中的 crate 之间需要相互依赖。如果每个 crate 都有自己的 _target_ 目录，那么每个 crate 都不得不重新编译工作区中的其他 crate 以将工件放置在其自身的 _target_ 目录中。通过共享一个 _target_ 目录，各个 crate 可以避免不必要的重新构建。

### 在工作区中创建第二个包

接下来，我们在工作区中创建一个额外的成员包，并将其命名为 `add_one`。生成一个名为 `add_one` 的新库 crate：

<!-- manual-regeneration
cd listings/ch14-more-about-cargo/output-only-02-add-one/add remove `"add_one"` from `members` list in Cargo.toml rm -rf add_one cargo new add_one --lib copy output below -->

```console
$ cargo new add_one --lib
     Created library `add_one` package
      Adding `add_one` as member of workspace at `file:///projects/add`
```

现在顶层 `_Cargo.toml` 中的 `members` 列表将包含 `_add_one_` 路径：

<span class="filename">Filename: Cargo.toml</span>

```toml
{{#include ../listings/ch14-more-about-cargo/no-listing-02-workspace-with-two-crates/add/Cargo.toml}}
```

你的 `_add_` 目录现在应该包含这些目录和文件：

```text
├── Cargo.lock
├── Cargo.toml
├── add_one
│   ├── Cargo.toml
│   └── src
│       └── lib.rs
├── adder
│   ├── Cargo.toml
│   └── src
│       └── main.rs
└── target
```

在 `_add_one/src/lib.rs` 文件中，让我们添加一个 `add_one` 函数：

<span class="filename">Filename: add_one/src/lib.rs</span>

```rust,noplayground
{{#rustdoc_include ../listings/ch14-more-about-cargo/no-listing-02-workspace-with-two-crates/add/add_one/src/lib.rs}}
```

现在，`adder` 包可以依赖我们的二进制程序，而该二进制程序依赖于我们的库。首先，我们需要在 `_adder/Cargo.toml` 中添加对 `add_one` 的路径依赖。

<span class="filename">Filename: adder/Cargo.toml</span>

```toml
{{#include ../listings/ch14-more-about-cargo/no-listing-02-workspace-with-two-crates/add/adder/Cargo.toml:6:7}}
```

Cargo 并不假设工作区中的 crate 会相互依赖，因此我们需要明确说明依赖关系。

接下来，让我们在 `adder` crate 中使用来自 `add_one` crate 的 `add_one` 函数。打开 `_adder/src/main.rs` 文件，将 `main` 函数修改为调用 `add_one` 函数，如清单 14-7 所示。

<Listing number="14-7" file-name="adder/src/main.rs" caption="Using the `add_one` library crate from the `adder` crate">

```rust,ignore
{{#rustdoc_include ../listings/ch14-more-about-cargo/listing-14-07/add/adder/src/main.rs}}
```

</Listing>

让我们通过在工作层级的 `_add_` 目录中运行 `cargo build` 来构建工作区！

<!-- manual-regeneration
cd listings/ch14-more-about-cargo/listing-14-07/add cargo build copy output below; 输出更新脚本无法正确处理路径中的子目录 -->

```console
$ cargo build
   Compiling add_one v0.1.0 (file:///projects/add/add_one)
   Compiling adder v0.1.0 (file:///projects/add/adder)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.22s
```

要运行来自 _add_ 目录的二进制 crate，我们可以通过使用 `-p` 参数指定要在工作区中运行的包名称，然后使用 `cargo run` 执行该命令：

<!-- manual-regeneration
cd listings/ch14-more-about-cargo/listing-14-07/add cargo run -p adder copy output below; the output updating script doesn't handle subdirectories in paths properly -->

```console
$ cargo run -p adder
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.00s
     Running `target/debug/adder`
Hello, world! 10 plus one is 11!
```

这会运行 _adder/src/main.rs_ 中的代码，而该代码依赖于 `add_one` crate。

<!-- Old headings. Do not remove or links may break. -->

<a id="depending-on-an-external-package-in-a-workspace"></a>

### 依赖外部包的情况

请注意，工作区在顶层只有一个 _Cargo.lock_ 文件，而不是在每个 crate 目录中都有一个 _Cargo.lock_ 文件。这确保了所有 crates 都使用相同版本的依赖项。如果我们将 `rand` 包添加到 _adder/Cargo.toml_ 和 _add_one/Cargo.toml_ 文件中，Cargo 会将这两个文件的 `rand` 解析为同一个版本，并将该信息记录到同一个 _Cargo.lock_ 中。让工作区中的所有 crates 使用相同的依赖项意味着这些 crates 将始终相互兼容。让我们将 `rand` crate 添加到 _add_one/Cargo.toml_ 文件的 `[dependencies]` 部分，这样我们就可以在 `add_one` crate 中使用 `rand` crate：

<!-- When updating the version of `rand` used, also update the version of
这些文件中使用的 `rand`，因此它们都匹配：

* ch01-01-installation.md * ch02-00-guessing-game-tutorial.md * ch07-04-bringing-paths-into-scope-with-the-use-keyword.md -->

<span class="filename">Filename: add_one/Cargo.toml</span>

```toml
{{#include ../listings/ch14-more-about-cargo/no-listing-03-workspace-with-external-dependency/add/add_one/Cargo.toml:6:7}}
```

现在我们可以在 _add_one/src/lib.rs_ 文件中添加 `use rand;` 语句，并在 _add_ 目录中运行 `cargo build` 来构建整个工作区时，将 `rand` crate 引入并编译。我们会得到一个警告，因为我们没有引用引入作用域中的 `rand`：

<!-- manual-regeneration
cd listings/ch14-more-about-cargo/no-listing-03-workspace-with-external-dependency/add cargo build copy output below; the output updating script doesn't handle subdirectories in paths properly -->

```console
$ cargo build
    Updating crates.io index
  Downloaded rand v0.10.1
   --snip--
   Compiling rand v0.10.1
   Compiling add_one v0.1.0 (file:///projects/add/add_one)
warning: unused import: `rand`
 --> add_one/src/lib.rs:1:5
  |
1 | use rand;
  |     ^^^^
  |
  = note: `#[warn(unused_imports)]` (part of `#[warn(unused)]`) on by default

warning: `add_one` (lib) generated 1 warning (run `cargo fix --lib -p add_one` to apply 1 suggestion)
   Compiling adder v0.1.0 (file:///projects/add/adder)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.95s
```

当前顶层的 _Cargo.lock_ 中包含了 `add_one` 依赖 `rand` 的信息。然而，即使 `rand` 在工作空间中的某个位置被使用，我们也无法在工作空间的其他 crates 中使用它，除非我们将 `rand` 也添加到这些 crates 的 _Cargo.toml_ 文件中。例如，如果我们在 `adder` 包的 _adder/src/main.rs_ 文件中添加 `use rand;`，将会出现错误：

<!-- manual-regeneration
cd listings/ch14-more-about-cargo/output-only-03-use-rand/add cargo build copy output below; the output updating script doesn't handle subdirectories in paths properly -->

```console
$ cargo build
  --snip--
   Compiling adder v0.1.0 (file:///projects/add/adder)
error[E0432]: unresolved import `rand`
 --> adder/src/main.rs:2:5
  |
2 | use rand;
  |     ^^^^ no external crate `rand`
```

为了解决这个问题，需要编辑 `adder` 包的 _Cargo.toml_ 文件，并说明 `rand` 也是该包的依赖项。构建 `adder` 包后，`rand` 会被添加到 _Cargo.lock_ 中 `adder` 的依赖列表，但不会下载额外的 `rand` 副本。只要工作空间中的使用 `rand` 包的每个 crate 都指定了兼容的 `rand` 版本，Cargo 就会确保它们使用相同的版本，从而节省空间并确保工作空间中的 crates 能够相互兼容。

如果工作空间中的 crates 指定了不兼容的同一依赖版本，Cargo 会分别解决这些冲突，但会尽量只处理最少的版本。

### 向工作空间添加测试

为了进一步改进，让我们在 `add_one` 包中为 `add_one::add_one` 函数添加一个测试：

<span class="filename">Filename: add_one/src/lib.rs</span>

```rust,noplayground
{{#rustdoc_include ../listings/ch14-more-about-cargo/no-listing-04-workspace-with-tests/add/add_one/src/lib.rs}}
```

现在在顶层的 _add_ 目录中运行 `cargo test`。以这种结构构建的工作空间中的 `cargo test` 会运行工作空间中所有 crates 的测试：

<!-- manual-regeneration
cd listings/ch14-more-about-cargo/no-listing-04-workspace-with-tests/add cargo test copy output below; the output updating script doesn't handle subdirectories in paths properly -->

```console
$ cargo test
   Compiling add_one v0.1.0 (file:///projects/add/add_one)
   Compiling adder v0.1.0 (file:///projects/add/adder)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.20s
     Running unittests src/lib.rs (target/debug/deps/add_one-93c49ee75dc46543)

running 1 test
test tests::it_works ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running unittests src/main.rs (target/debug/deps/adder-3a47283c568d2b6a)

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

   Doc-tests add_one

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

输出的第一部分显示 `add_one` 包中的 `it_works` 测试通过。下一部分显示 `adder` 包中没有找到任何测试，最后一部分显示 `add_one` 包中没有找到文档测试。

我们还可以从顶层目录开始，使用 `-p` 标志并指定要测试的 crate 名称，来在工作空间中对特定的 crate 运行测试：

<!-- manual-regeneration
cd listings/ch14-more-about-cargo/no-listing-04-workspace-with-tests/add cargo test -p add_one copy output below; the output updating script doesn't handle subdirectories in paths properly -->

```console
$ cargo test -p add_one
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.00s
     Running unittests src/lib.rs (target/debug/deps/add_one-93c49ee75dc46543)

running 1 test
test tests::it_works ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

   Doc-tests add_one

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

此输出表明 `cargo test` 仅运行了 `add_one` crate 的测试，而没有运行 `adder` crate 的测试。

如果您将工作空间中的 crates 发布到 [crates.io](https://crates.io/)<!-- ignore -->，则工作空间中的每个 crate 都需要单独发布。就像使用 `cargo test` 一样，我们也可以使用 `-p` 标志并指定要发布的 crate 名称来发布工作空间中的特定 crate。

为了进行更多练习，请以与 `add_one` crate 类似的方式向此工作空间添加 `add_two` crate！

随着项目的增长，考虑使用工作空间：它允许您处理更小型、更易于理解的组件，而不是一个巨大的代码块。此外，如果多个 crate 经常同时被修改，将 crates 放在工作空间中可以使它们之间的协调更加容易。
