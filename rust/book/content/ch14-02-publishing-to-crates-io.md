## 将 crate 发布到 Crates.io

我们已将 [crates.io](https://crates.io/) 的包作为项目的依赖项，但您也可以通过发布自己的包来与他人共享代码。[crates.io](https://crates.io/) 的 crate 注册表会分发您的包的源代码，因此主要托管的是开源代码。

Rust 和 Cargo 有一些功能可以使得您发布的包更容易被他人找到和使用。接下来我们将讨论这些功能中的一些，然后说明如何发布一个包。

### 编写有用的文档注释

准确记录您的包信息有助于其他用户了解如何使用它们以及何时使用它们，因此花时间编写文档是值得的。在第三章中，我们讨论了如何使用两个斜杠 `//` 来注释 Rust 代码。Rust 还有一种专门用于文档的注释类型，称为 _文档注释_，这种注释可以生成 HTML 文档。HTML 会显示面向程序员的公共 API 项目的文档注释内容，这些程序员感兴趣的是如何 _使用_ 您的包，而不是您的包是如何 _实现_ 的。

文档注释使用三个斜杠 `///`，而不是两个，并支持 Markdown 格式来格式化文本。将文档注释放在它们所描述的项之前即可。列表 14-1 展示了名为 `my_crate` 的包中 `add_one` 函数的文档注释。

<Listing number="14-1" file-name="src/lib.rs" caption="A documentation comment for a function">

```rust,ignore
{{#rustdoc_include ../listings/ch14-more-about-cargo/listing-14-01/src/lib.rs}}
```

</Listing>

在这里，我们描述了 `add_one` 函数的作用，以 `Examples` 作为章节标题，然后提供演示如何使用 `add_one` 函数的代码。通过运行 `cargo doc` 命令可以从这些文档注释生成 HTML 文档。该命令使用随 Rust 提供的 `rustdoc` 工具，并将生成的 HTML 文档保存到 `_target/doc_` 目录中。

为了方便，运行 `cargo doc --open` 可以生成当前 crate 文档的 HTML（以及所有依赖库文档），并在浏览器中打开结果。导航到 `add_one` 函数，您将看到文档注释中的文本是如何呈现的，如图 14-1 所示。

<img alt="Rendered HTML documentation for the `add_one` function of `my_crate`" src="img/trpl14-01.png" class="center" />

<span class="caption">Figure 14-1: The HTML documentation for the `add_one`
function</span>

#### 常用部分

我们在列表 14-1 中使用 `# Examples` Markdown 标题在 HTML 中创建了一个名为“Examples”的部分。以下是 crate 作者在其文档中常用的其他部分：

- **Panics**：这些是被文档化的函数可能引发 panic 的场景。不想让程序发生 panic 的调用者应确保在这些情况下不要调用该函数。
- **Errors**：如果函数返回 `Result`，描述可能发生的错误类型以及可能导致这些错误的情况，可以帮助调用者编写代码以不同方式处理各种错误。
- **Safety**：如果函数不可安全调用（我们在第 20 章讨论过不可安全性），应该有一个部分解释为什么该函数不安全，并涵盖函数期望调用者遵守的不变量。

大多数文档注释不需要所有这些部分，但这是一个好的检查清单，提醒您代码用户可能感兴趣了解的方面。

#### 文档注释作为测试

在文档注释中添加示例代码块有助于展示如何使用您的库，并且还有一个额外的好处：运行 `cargo test` 将把文档中的代码示例作为测试运行！没有比带有示例的文档更好的了。但也没有比因代码自文档编写后发生变化而无法运行的示例更糟糕的。如果我们使用列表 14-1 中的 `add_one` 函数的文档来运行 `cargo test`，我们将在测试结果中看到类似这样的部分：

<!-- manual-regeneration
cd listings/ch14-more-about-cargo/listing-14-01/ cargo test copy just the doc-tests section below -->

```text
   Doc-tests my_crate

running 1 test
test src/lib.rs - add_one (line 5) ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.27s
```

现在，如果我们修改函数或示例，使得示例中使用的 `assert_eq!` 引发 panic，然后再次运行 `cargo test`，我们会看到文档测试能够检测到示例与代码之间的不一致！

<!-- Old headings. Do not remove or links may break. -->

<a id="commenting-contained-items"></a>

#### 包含项注释

文档注释风格中的 `//!` 用于向包含该注释的项提供文档说明，而不是指向该注释之后的项目。我们通常将此类文档注释放在 crate 根文件 (_src/lib.rs_ 按惯例) 或模块内部，以描述整个 crate 或模块的内容。

例如，为了添加关于包含 `add_one` 函数的 `my_crate` crate 用途的文档说明，我们会在 _src/lib.rs_ 文件的开头添加以 `//!` 开头的文档注释，如清单 14-2 所示。

<Listing number="14-2" file-name="src/lib.rs" caption="The documentation for the `my_crate` crate as a whole">

```rust,ignore
{{#rustdoc_include ../listings/ch14-more-about-cargo/listing-14-02/src/lib.rs:here}}
```

</Listing>

请注意，最后一行之后没有以 `//!` 开头的代码。由于我们是以 `//!` 而不是 `///` 开始注释的，因此我们在描述包含该注释的项，而非该注释之后的项目。在这种情况下，该项就是 _src/lib.rs_ 文件，即 crate 的根目录。这些注释描述了整个 crate。

当我们运行 `cargo doc --open` 时，这些注释将在 `my_crate` 的文档首页上显示，位于 crate 中公共项目的列表上方，如图 14-2 所示。

项内的文档注释特别有助于描述 crate 和模块。使用它们来解释容器的整体用途，以帮助用户理解 crate 的组织结构。

<img alt="Rendered HTML documentation with a comment for the crate as a whole" src="img/trpl14-02.png" class="center" />

<span class="caption">Figure 14-2: The rendered documentation for `my_crate`,
包括描述整个 crate 的注释</span>

<!-- Old headings. Do not remove or links may break. -->

<a id="exporting-a-convenient-public-api-with-pub-use"></a>

### 导出便捷的公共 API

在发布 crate 时，公共 API 的结构是一个重要的考虑因素。使用你的 crate 的人对结构的了解不如你，如果 crate 包含复杂的模块层次结构，他们可能难以找到想要使用的部分。

在第7章中，我们介绍了如何使用 `pub` 关键字将项公开，以及如何使用 `use` 关键字将其引入作用域。然而，你在开发 crate 时觉得合理的结构可能并不方便其他用户使用。你可能希望将结构体组织成包含多层的层次结构，但这样那些在深层结构中使用的类型使用者可能会难以发现该类型的存在。他们还可能因需要输入 `use my_crate::some_module::another_module::UsefulType;` 而不是 `use my_crate::UsefulType;` 而感到困扰。

好消息是，如果某种结构不方便其他库使用，你不必重新调整内部组织：相反，你可以使用 `pub use` 来重新导出项，从而创建一个与私有结构不同的公开结构。*重新导出* 意味着在一个位置将公共项公开，在另一个位置将其再次公开，就像它原本就在那个位置定义一样。

例如，假设我们创建了一个名为 `art` 的库用于建模艺术概念。该库包含两个模块：一个 `kinds` 模块包含两个枚举 `PrimaryColor` 和 `SecondaryColor`，以及一个 `utils` 模块包含一个名为 `mix` 的函数，如清单 14-3 所示。

<Listing number="14-3" file-name="src/lib.rs" caption="An `art` library with items organized into `kinds` and `utils` modules">

```rust,noplayground,test_harness
{{#rustdoc_include ../listings/ch14-more-about-cargo/listing-14-03/src/lib.rs:here}}
```

</Listing>

图 14-3 展示了 `cargo doc` 生成的该 crate 文档首页的样式。

<img alt="Rendered documentation for the `art` crate that lists the `kinds` and `utils` modules" src="img/trpl14-03.png" class="center" />

<span class="caption">Figure 14-3: The front page of the documentation for `art`
它列出了 `kinds` 和 `utils` 模块</span>

请注意，`PrimaryColor` 和 `SecondaryColor` 类型以及 `mix` 函数都没有出现在首页上。我们必须点击 `kinds` 和 `utils` 才能看到它们。

依赖此库的另一个 crate 需要 `use` 语句来引入来自 `art` 的项，并指定当前定义的模块结构。清单 14-4 展示了一个使用 `art` crate 中的 `PrimaryColor` 和 `mix` 项的示例 crate。

<Listing number="14-4" file-name="src/main.rs" caption="A crate using the `art` crate’s items with its internal structure exported">

```rust,ignore
{{#rustdoc_include ../listings/ch14-more-about-cargo/listing-14-04/src/main.rs}}
```

</Listing>

清单 14-4 中的代码使用 `art` crate，其作者必须意识到 `PrimaryColor` 位于 `kinds` 模块中，而 `mix` 位于 `utils` 模块中。`art` crate 的模块结构对开发 `art` crate 的开发者更为相关，而非使用它的开发者。该内部结构并不包含任何有助于理解如何使用 `art` crate 的信息，反而会导致困惑，因为使用它的开发者必须弄清楚该去哪里查找，并且必须在 `use` 语句中指定模块名称。

为了从公共 API 中移除内部组织方式，我们可以修改清单 14-3 中的 `art` crate 代码，添加 `pub use` 语句以重新导出顶层级别的项，如清单 14-5 所示。

<Listing number="14-5" file-name="src/lib.rs" caption="Adding `pub use` statements to re-export items">

```rust,ignore
{{#rustdoc_include ../listings/ch14-more-about-cargo/listing-14-05/src/lib.rs:here}}
```

</Listing>

`cargo doc` 为这个 crate 生成的 API 文档现在会在首页列出并链接到重新导出项，如图 14-4 所示，这使得 `PrimaryColor` 和 `SecondaryColor` 类型以及 `mix` 函数更容易被找到。

<img alt="Rendered documentation for the `art` crate with the re-exports on the front page" src="img/trpl14-04.png" class="center" />

<span class="caption">Figure 14-4: The front page of the documentation for `art`
该列表列出了重新导出项</span>

`art` crate 的用户仍然可以像清单 14-4 中展示的那样查看和使用清单 14-3 中的内部结构，或者他们可以使用清单 14-5 中更便捷的结构，如清单 14-6 所示。

<Listing number="14-6" file-name="src/main.rs" caption="A program using the re-exported items from the `art` crate">

```rust,ignore
{{#rustdoc_include ../listings/ch14-more-about-cargo/listing-14-06/src/main.rs:here}}
```

</Listing>

在存在许多嵌套模块的情况下，使用 `pub use` 重新导出顶层级别的类型可以显著改善使用该 crate 的人的体验。`pub use` 的另一个常见用途是重新导出当前 crate 中依赖项的定义，使该依赖项的定义成为你 crate 的公共 API 的一部分。

创建有用的公共 API 结构更像是一门艺术而非科学，你可以不断迭代以找到最适合你的用户的 API。选择 `pub use` 可以让你在内部构建 crate 的结构上拥有灵活性，并将内部结构与你向用户展示的内容分离开来。查看你安装的某些 crates 的代码，看看它们的内部结构与公共 API 是否有差异。

### 设置 Crates.io 账户

在发布任何 crates 之前，您需要在 [crates.io](https://crates.io/) 上创建账户并获取 API 令牌。为此，请访问 [crates.io](https://crates.io/) 的主页，通过 GitHub 账户登录。（目前需要 GitHub 账户，但未来该网站可能支持其他账户创建方式。）登录后，请访问 [https://crates.io/me/](https://crates.io/me/) 查看您的账户设置并获取 API 密钥。然后，运行 `cargo login` 命令并在提示时粘贴您的 API 密钥。

```console
$ cargo login
abcdefghijklmnopqrstuvwxyz012345
```

此命令会将您的 API 令牌告知 Cargo，并将其本地存储在 _~/.cargo/credentials.toml_ 中。请注意，该令牌是机密信息：不要与任何人分享。如果您出于任何原因与他人共享该令牌，您应撤销它并在 [crates.io](https://crates.io/) 生成新令牌。

### 向新 crates 添加元数据

假设您有一个想要发布的 crates。在发布之前，您需要将在 crates 的 _Cargo.toml_ 文件的 `[package]` 部分添加一些元数据。

您的 crates 需要一个唯一的名称。在本地开发 crates 时，您可以随意命名。然而，[crates.io](https://crates.io/) 上的 crates 名称是按先来后得原则分配的。一旦某个 crates 名称被占用，其他人就无法使用该名称发布 crates。在尝试发布 crates 之前，请搜索您想要使用的名称。如果名称已被使用，您需要找到另一个名称，并编辑 _Cargo.toml_ 文件中 `[package]` 部分的 `name` 字段，以使用新名称进行发布。

<span class="filename">Filename: Cargo.toml</span>

```toml
[package]
name = "guessing_game"
```

即使您选择了唯一的名称，当此时运行 `cargo publish` 来发布 crates 时，您会收到警告然后出现错误：

<!-- manual-regeneration
创建一个未注册名称的新包，不对生成的包进行进一步修改，因此缺少描述和许可证字段。运行 `cargo publish copy` 仅复制以下相关行 -->

```console
$ cargo publish
    Updating crates.io index
warning: manifest has no description, license, license-file, documentation, homepage or repository.
See https://doc.rust-lang.org/cargo/reference/manifest.html#package-metadata for more info.
--snip--
error: failed to publish to registry at https://crates.io

Caused by:
  the remote server responded with an error (status 400 Bad Request): missing or empty metadata fields: description, license. Please see https://doc.rust-lang.org/cargo/reference/manifest.html for more information on configuring these fields
```

这会导致错误，因为你缺少一些关键信息：需要提供描述与许可证，以便人们了解你的库的功能以及他们可以在何种条件下使用它。在 _Cargo.toml_ 文件中，添加一两句话的描述，因为该描述会出现在你的库的搜索结果中。对于 `license` 字段，你需要提供一个 _license identifier 值_。[Linux Foundation 的软件包数据交换 (SPDX)][spdx] 列出了可用于此值的标识符。例如，若要说明你使用 MIT 许可证授权了你的库，请添加 `MIT` 标识符：

<span class="filename">Filename: Cargo.toml</span>

```toml
[package]
name = "guessing_game"
license = "MIT"
```

如果你想要使用的许可证不在 SPDX 中列出，你需要将该许可证的文本放在一个文件中，将该文件包含到项目中，然后使用 `license-file` 来指定该文件的名称，而不是使用 `license` 键。

关于哪种许可证适合你的项目的具体指导超出了本书的范围。Rust 社区中的许多人采用与 Rust 相同的方式对他们的项目使用双重许可证，即 `MIT OR Apache-2.0`。这种做法表明你也可以通过使用 `OR` 分隔多个许可证标识符来为项目设置多种许可证。

一旦添加了唯一的名称、版本、描述以及许可证后，准备发布的项目的 _Cargo.toml_ 文件可能如下所示：

<span class="filename">Filename: Cargo.toml</span>

```toml
[package]
name = "guessing_game"
version = "0.1.0"
edition = "2024"
description = "A fun game where you guess what number the computer has chosen."
license = "MIT OR Apache-2.0"

[dependencies]
```

[Cargo 文档](https://doc.rust-lang.org/cargo/)描述了其他你可以指定的元数据，以确保其他人能够更轻松地发现和使用你的库。

### 在 Crates.io 上发布

现在你已经创建了账户、保存了 API 令牌、选择了库的名称并指定了所需的元数据，你就准备发布啦！发布一个库意味着将特定版本上传到 [crates.io](https://crates.io/) 供他人使用。

请注意，发布是_永久的_。版本无法被覆盖，代码也只有在特定情况下才能删除。Crates.io 的主要目标之一就是作为代码的永久归档库，这样所有依赖 [crates.io](https://crates.io/) 项目的构建都能继续运行。如果允许删除版本，则无法实现这一目标。不过，你可以发布的 crate 版本数量没有限制。

再次运行 `cargo publish` 命令，现在应该会成功：

<!-- manual-regeneration
访问某个有效的 crate，发布新版本 cargo publish copy just the relevant lines below -->

```console
$ cargo publish
    Updating crates.io index
   Packaging guessing_game v0.1.0 (file:///projects/guessing_game)
    Packaged 6 files, 1.2KiB (895.0B compressed)
   Verifying guessing_game v0.1.0 (file:///projects/guessing_game)
   Compiling guessing_game v0.1.0
(file:///projects/guessing_game/target/package/guessing_game-0.1.0)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.19s
   Uploading guessing_game v0.1.0 (file:///projects/guessing_game)
    Uploaded guessing_game v0.1.0 to registry `crates-io`
note: waiting for `guessing_game v0.1.0` to be available at registry
`crates-io`.
You may press ctrl-c to skip waiting; the crate should be available shortly.
   Published guessing_game v0.1.0 at registry `crates-io`
```

恭喜你！你现在已将代码分享给 Rust 社区，任何人都可以轻松地将你的 crate 作为项目的依赖项添加进来。

### 发布现有 crate 的新版本

当你对 crate 进行了修改并准备发布新版本时，只需在 _Cargo.toml_ 文件中更改 `version` 值，然后重新发布即可。使用 [语义化版本规范][semver] 来确定合适的下一个版本号，该版本号应基于你所做的更改类型而定。之后运行 `cargo publish` 以上传新版本。

<!-- Old headings. Do not remove or links may break. -->

<a id="removing-versions-from-cratesio-with-cargo-yank"></a>
<a id="deprecating-versions-from-cratesio-with-cargo-yank"></a>

### 禁用 Crates.io 中的版本

虽然无法移除 crate 的旧版本，但你可以防止未来项目将其作为新的依赖项添加进来。当某个 crate 版本因某种原因出现问题时，这是非常有用的。在这种情况下，Cargo 支持“拉取”版本。

“拉取”版本可以防止新项目依赖该版本，同时允许所有依赖它的现有项目继续运行。本质上，“拉取”意味着所有包含 _Cargo.lock_ 的项目不会崩溃，且未来生成的 _Cargo.lock_ 文件不会使用被拉取的版本。

要拉取 crate 的版本，在之前发布该 crate 的目录中运行 `cargo yank`，并指定你想拉取的版本号。例如，如果我们发布了名为 `guessing_game` 的 crate 1.0.1 版本，想要将其拉取，则应在 `guessing_game` 项目的目录中运行以下命令：

<!-- manual-regeneration:
cargo yank carol-test --version 2.1.0 cargo yank carol-test --version 2.1.0 --undo -->

```console
$ cargo yank --vers 1.0.1
    Updating crates.io index
        Yank guessing_game@1.0.1
```

通过在命令中添加 `--undo` 参数，您也可以撤销 yank 操作，使项目能够再次根据特定版本启动：

```console
$ cargo yank --vers 1.0.1 --undo
    Updating crates.io index
      Unyank guessing_game@1.0.1
```

yank _不会_ 删除任何代码。例如，它无法意外删除上传的机密信息。如果发生这种情况，您必须立即重置这些机密信息。

[spdx]: https://spdx.org/licenses/
[semver]: https://semver.org/
