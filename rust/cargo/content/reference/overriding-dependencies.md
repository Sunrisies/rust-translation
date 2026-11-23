# 覆盖依赖项

出于多种原因，人们可能希望覆盖一个依赖项。然而，大多数情况都归结为在该 crate 被发布到 [crates.io] 之前能够使用它。例如：

* 你正在使用的 crate 也被另一个更大的应用程序使用，你想在更大应用程序中测试对该库的 bug 修复。
* 你没有参与的一个上游 crate 在其 git 仓库的主分支上有新功能或 bug 修复，你想测试这些更改。
* 你即将发布新版本的重大 crate 版本，但你想对整个包进行集成测试，以确保新版本能够正常工作。
* 你已经向一个上游 crate 提交了关于发现的 bug 的修复，但你希望立即让应用程序依赖已修复版本的 crate，以避免在 bug 修复合并时出现阻塞问题。

这些场景可以通过 [`[patch]` 清单 部分](#the-patch-section)来解决。

本章介绍了几种不同的使用案例，并详细说明了覆盖依赖项的不同方法。

* 示例使用案例 * [测试 bug 修复](#testing-a-bugfix) * [使用未发布的次要版本](#working-with-an-unpublished-minor-version) * [覆盖仓库 URL](#overriding-repository-url) * [在发布前进行破坏性变更](#prepublishing-a-breaking-change) * [使用多个版本的 `[patch]`](#using-patch-with-multiple-versions) * 参考 * [`[patch]` 部分](#the-patch-section) * [`[replace]` 部分](#the-replace-section) * [`paths` 覆盖](#paths-overrides)

> [!NOTE]
> 另请参阅使用[多个位置]指定依赖项，这可用于覆盖本地包中单个依赖项声明的来源。

## 测试 bug 修复

假设你正在使用 [`uuid` crate]，但在处理过程中发现了 bug。不过，你很聪明，决定也尝试修复这个 bug！最初你的 清单 看起来像这样：


```toml
[package]
name = "my-library"
version = "0.1.0"

[dependencies]
uuid = "1.0"
```

首先，我们通过以下方式在本地克隆 [`uuid` 仓库][uuid-repository]：

```console
$ git clone https://github.com/uuid-rs/uuid.git
```

接下来，我们将编辑 `my-library` 的清单以包含以下内容：

```toml
[patch.crates-io]
uuid = { path = "../path/to/uuid" }
```

在这里，我们声明正在使用新的依赖项来*修补*源文件 `crates-io`。这将有效地将本地下载的 `uuid` 版本添加到 crates.io 注册表中，用于我们的本地包。

接下来，我们需要确保锁定文件更新为使用这个新版本的 `uuid`，这样我们的包就会使用本地下载的副本而不是来自 crates.io 的版本。 `[patch]` 的工作方式是在 `../path/to/uuid` 加载依赖项，然后每当 crates.io 查询 `uuid` 的版本时，它也会返回本地版本。

这意味着本地下载的版本号非常重要，会影响是否使用补丁。我们的清单中声明了 `uuid = "1.0"`，这意味着我们将解析为 `>= 1.0.0, < 2.0.0`，而 Cargo 贪婪解析算法也意味着我们将解析为该范围内的最大版本。通常这并不重要，因为 git 仓库的版本已经更大或与 crates.io 发布的版本相同，但记住这一点很重要！

无论如何，通常你现在只需要做以下事情：

```console
$ cargo build
   Compiling uuid v1.0.0 (.../uuid)
   Compiling my-library v0.1.0 (.../my-library)
    Finished dev [unoptimized + debuginfo] target(s) in 0.32 secs
```

就这样！你现在正在使用本地版本的 `uuid` 进行构建（注意构建输出中的括号中的路径）。如果你没有看到本地路径版本被构建出来，那么你可能需要运行 `cargo update uuid --precise $version`，其中 `$version` 是本地下载的 `uuid` 版本号。

一旦你修复了最初发现的错误，接下来你需要将修复内容作为拉取请求提交到 `uuid` crate 本身。完成这一步后，你也可以更新 `[patch]` 部分。`[patch]` 中的列表与 `[dependencies]` 部分相同，因此当你的拉取请求被合并后，你可以将 `path` 依赖项更改为：

```toml
[patch.crates-io]
uuid = { git = 'https://github.com/uuid-rs/uuid.git' }
```


## 使用未发布的次要版本进行开发

现在让我们从错误修复转向添加功能。在开发 `my-library` 时，你发现 `uuid` crate 需要一项全新的功能。你已经实现了该功能，并在本地使用 `[patch]` 进行了测试，然后提交了拉取请求。让我们回顾一下你在实际发布之前如何继续使用并测试它。

还需要注意的是，`crates.io` 上 `uuid` 的当前版本为 `1.0.0`，但自那以后 git 仓库的主分支已更新为 `1.0.1`。这个分支包含了你之前提交的新的功能。要使用该仓库，我们需要修改 `Cargo.toml` 文件。

```toml
[package]
name = "my-library"
version = "0.1.0"

[dependencies]
uuid = "1.0.1"

[patch.crates-io]
uuid = { git = 'https://github.com/uuid-rs/uuid.git' }
```

请注意，我们对 `uuid` 的本地依赖已更新为 `1.0.1`，因为一旦 crate 发布后我们将实际需要这个版本。不过这个版本并不存在于 `crates.io` 上，因此我们在清单中添加了 `[patch]` 部分来提供它。

现在当我们的库被构建时，它会从 git 仓库获取 `uuid`，并在仓库内部解析为 `1.0.1`，而不是尝试从 `crates.io` 下载版本。一旦 `1.0.1` 在 `crates.io` 上发布，`[patch]` 部分就可以被删除。

同样值得注意的是，`[patch]` 是 *传递性* 的。假设你在更大的包中使用 `my-library`，例如：

```toml
[package]
name = "my-binary"
version = "0.1.0"

[dependencies]
my-library = { git = 'https://example.com/git/my-library' }
uuid = "1.0"

[patch.crates-io]
uuid = { git = 'https://github.com/uuid-rs/uuid.git' }
```

请记住，`[patch]` 是 *传递性* 的，但只能在 *顶层* 定义，因此 `my-library` 的使用者如果有必要，必须重复添加 `[patch]` 部分。不过在这里，新的 `uuid` crate 同时适用于我们对 `uuid` 的依赖以及 `my-library -> uuid` 依赖。`uuid` crate 将为整个 crate 图解析为一个版本，即 `1.0.1`，并且会从 git 仓库中下载。

### 覆盖仓库 URL

如果你想覆盖的依赖没有从 `crates.io` 加载，你需要稍微改变使用 `[patch]` 的方式。例如，如果依赖是一个 git 依赖，你可以将其覆盖为本地路径：

```toml
[patch."https://github.com/your/repository"]
my-library = { path = "../my-library/path" }
```

就这样！

## 发布前破坏性变更

让我们来看看如何使用新版本의 crate，通常伴随着破坏性变更。沿用之前的 crates 为例，这意味着我们将创建 `uuid` crate 的 2.0.0 版本。在将所有更改提交到上游后，我们可以更新 `my-library` 的 清单，如下所示：

```toml
[dependencies]
uuid = "2.0"

[patch.crates-io]
uuid = { git = "https://github.com/uuid-rs/uuid.git", branch = "2.0.0" }
```

就这样！与前面的示例类似，2.0.0 版本实际上并不存在于 crates.io 上，但我们可以通过使用 `[patch]` 部分通过 git 依赖 将其引入。作为思考练习，让我们再次看看上面的 `my-binary` 清单：

```toml
[package]
name = "my-binary"
version = "0.1.0"

[dependencies]
my-library = { git = 'https://example.com/git/my-library' }
uuid = "1.0"

[patch.crates-io]
uuid = { git = 'https://github.com/uuid-rs/uuid.git', branch = '2.0.0' }
```

请注意，这将实际解析为 `uuid` crate 的两个版本。`my-binary` crate 将继续使用 `uuid` crate 的 1.x.y 系列，而 `my-library` crate 则使用 `uuid` 的 `2.0.0` 版本。这允许你通过依赖图逐步推出 crate 的破坏性变更，而不必一次性更新所有内容。

## 使用多个版本的 `[patch]`

你可以使用 `package` key 来重命名依赖项，从而引入同一 crate 的多个版本进行 patch。例如，假设 `serde` crate 有一个修复问题，我们希望在 git repository 中使用其 `1.*` 系列，但同时又想使用我们仓库中的 `2.0.0` 版本的 serde 进行原型开发。为此，我们需要执行以下操作：

```toml
[patch.crates-io]
serde = { git = 'https://github.com/serde-rs/serde.git' }
serde2 = { git = 'https://github.com/example/serde.git', package = 'serde', branch = 'v2' }
```

第一个 `serde = ...` 指令表示应从 git repository 中拉取 `serde` `1.*` 系列（即所需的修复问题），第二个 `serde2 = ...` 指令则表示还应从 `https://github.com/example/serde` 的 `v2` 分支中拉取 `serde` 包。这里我们假设该分支上的 `Cargo.toml` 提到了版本 `2.0.0`。

请注意，当使用 `package` key 时，`serde2` 标识符实际上被忽略。我们只需要一个不与其他 patch crates 冲突的唯一名称即可。

## `[patch]` 部分

`Cargo.toml` 中的 `[patch]` 部分可用于用其他副本覆盖依赖项。其语法与 [`[dependencies]`][dependencies] 部分类似：

```toml
[patch.crates-io]
foo = { git = 'https://github.com/example/foo.git' }
bar = { path = 'my/local/bar' }

[dependencies.baz]
git = 'https://github.com/example/baz.git'

[patch.'https://github.com/example/baz']
baz = { git = 'https://github.com/example/patched-baz.git', branch = 'my-branch' }
```

> [!NOTE]
> `[patch]` 表也可以作为 [配置选项](config.md) 指定，例如在 `.cargo/config.toml` 文件中或 CLI 选项中，如 `--config 'patch.crates-io.rand.path="rand"'`。这适用于您不想提交本地更改的情况，或者用于临时测试补丁。

`[patch]` 表由类似依赖项的子表组成。 `[patch]` 之后的每个键都是被修补的源代码的 URL，或是注册表的名称。使用 `crates-io` 可以覆盖默认的 [crates.io] 注册表。上面的第一个 `[patch]` 示例展示了如何覆盖 [crates.io]，第二个 `[patch]` 则展示了如何覆盖 git 源代码。

这些表中的每个条目都是正常的依赖项规范，与清单中的 `[dependencies]` 部分相同。`[patch]` 部分中列出的依赖项会被解析并用于按照指定的 URL 修补源代码。上述清单片段使用 `foo` 和 `bar` 包来修补 `crates-io` 源代码（例如 crates.io 本身），同时用来自其他地方的 `my-branch` 来修补 `https://github.com/example/baz` 源代码。

源代码可以使用不存在的 crate 版本进行修补，也可以使用已存在的 crate 版本进行修补。如果某个源代码使用源代码中已存在的 crate 版本进行修补，则原代码会被替换。

Cargo 仅查看工作空间根目录中的 `Cargo.toml` 清单中的补丁设置。依赖项中定义的补丁设置将被忽略。

## `[replace]` 部分

> [!IMPORTANT]
> `[replace]` 已过时，您应该改用 [`[patch]`](#the-patch-section) 表。

Cargo.toml 的此部分可用于用其他副本覆盖依赖项。语法与 `[dependencies]` 部分类似：

```toml
[replace]
"foo:0.1.0" = { git = 'https://github.com/example/foo.git' }
"bar:1.0.2" = { path = 'my/local/bar' }
```

`[replace]` 表中的每个键都是 `[package ID specification](pkgid-spec.md)`，允许任意选择依赖图中一个节点来覆盖它（需要包含3部分版本号）。每个键的值与指定依赖关系的 `[dependencies]` 语法相同，只是不能指定特性。请注意，当某个包被覆盖时，被覆盖的副本必须具有相同的名称和版本，但它可以来自不同的来源（例如 git 或本地路径）。

Cargo 仅查看工作空间根目录中的 `Cargo.toml` 文件中的替换设置。在依赖项中定义的替换设置将被忽略。

## `paths` 覆盖

有时你只是临时处理某个包，不想像 `[patch]` 部分那样修改 `Cargo.toml`。对于这种场景，Cargo 提供了一种更有限的覆盖机制，称为 **path overrides**。

Path overrides 通过 `[.cargo/config.toml](config.md)` 而不是 `Cargo.toml` 来指定。在 `.cargo/config.toml` 中，你需要指定一个名为 `paths` 的键：

```toml
paths = ["/path/to/uuid"]
```

这个数组应包含包含 `Cargo.toml` 的目录。在这个例子中，我们只是添加 `uuid`，因此它将是唯一的被覆盖项。此路径可以是绝对的，也可以相对于包含 `.cargo` 文件夹的目录是相对的。

Path overrides 的限制比 `[patch]` 部分更多，因为它们不能改变依赖图的结构。当使用路径替换时，之前的依赖关系必须完全符合新的 `Cargo.toml` 规范。这意味着 path overrides 不能用于测试向包添加依赖关系的过程，在这种情况下必须使用 `[patch]`。因此，使用 path override 通常仅用于快速修复错误，而不是大规模更改。

> [!NOTE]
> 使用本地配置来覆盖路径仅适用于已发布到 [crates.io] 的包。你不能使用此功能来告诉 Cargo 如何找到未发布的本地包。

[`uuid` crate]: https://crates.io/crates/uuid
[uuid-repository]: https://github.com/uuid-rs/uuid
[crates.io]: https://crates.io/
[multiple locations]: specifying-dependencies.md#multiple-locations
[dependencies]: specifying-dependencies.md
