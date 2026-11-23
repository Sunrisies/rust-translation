# 依赖解析

Cargo 的主要任务之一是根据每个包中指定的版本要求确定要使用的依赖版本。这一过程被称为“依赖解析”，由“解析器”执行。解析结果存储在 [`Cargo.lock` 文件中]，该文件会“锁定”依赖项到特定版本，并使其随时间保持不变。`cargo tree` 命令可用于可视化解析器的结果。


## 约束与启发式规则

在许多情况下，没有唯一的“最佳”依赖解析方式。解析器在各种约束和启发式规则下运作，以找到一种普遍适用的解决方案。为了理解这些机制如何相互作用，先对依赖解析的工作原理有一个大致了解会很有帮助。

以下伪代码近似了 Cargo 解析器的工作过程：
```rust
pub fn resolve(workspace: &[Package], policy: Policy) -> Option<ResolveGraph> {
    let dep_queue = Queue::new(workspace);
    let resolved = ResolveGraph::new();
    resolve_next(dep_queue, resolved, policy)
}

fn resolve_next(dep_queue: Queue, resolved: ResolveGraph, policy: Policy) -> Option<ResolveGraph> {
    let Some(dep_spec) = policy.pick_next_dep(&mut dep_queue) else {
        // Done
        return Some(resolved);
    };

    if let Some(resolved) = policy.try_unify_version(dep_spec, resolved.clone()) {
        return Some(resolved);
    }

    let dep_versions = dep_spec.lookup_versions()?;
    let mut dep_versions = policy.filter_versions(dep_spec, dep_versions);
    while let Some(dep_version) = policy.pick_next_version(&mut dep_versions) {
        if policy.needs_version_unification(&dep_version, &resolved) {
            continue;
        }

        let mut dep_queue = dep_queue.clone();
        dep_queue.enqueue(&dep_version.dependencies);
        let mut resolved = resolved.clone();
        resolved.register(dep_version);
        if let Some(resolved) = resolve_next(dep_queue, resolved, policy) {
            return Some(resolved);
        }
    }

    // No valid solution found, backtrack and `pick_next_version`
    None
}
```

关键步骤： - 遍历依赖项（`pick_next_dep`）：依赖项的遍历顺序会影响同一依赖项的相关版本要求的解析方式，参见“统一版本”部分，以及解析器回退的程度对解析器性能的影响； - 统一版本（`try_unify_version`, `needs_version_unification`）：Cargo 在可能的情况下重用版本以缩短构建时间，并允许来自常见依赖的类型在不同 API 之间传递。如果由于[依赖规范]中的冲突而不需要统一多个版本，Cargo 会进行回退，若找不到解决方案则报错，而不是选择多个版本；[依赖规范]或 Cargo 可能会认为某个版本不理想，更倾向于回退或报错而非使用该版本。 - 优先选择版本（`pick_next_version`）：Cargo 可能决定优先选择特定版本，在回退时则选择下一个版本。

### 版本号

通常，Cargo 会优先选择当前可用的最高版本。

例如，如果你在 resolve graph 中有一个包包含：
```toml
[dependencies]
bitflags = "*"
```
如果在生成 `Cargo.lock` 文件时，`bitflags` 的最高版本为 `1.2.1`，那么该包将使用 `1.2.1`。

关于可能的异常示例，请参见 [Rust version](#rust-version)。

### 版本要求

通过 [版本要求] 机制，包可以指定它们支持的版本号，并拒绝其他所有版本。

例如，如果你在 resolve graph 中有一个包包含：
```toml
[dependencies]
bitflags = "1.0"  # meaning `>=1.0.0,<2.0.0`
```
如果在生成 `Cargo.lock` 文件时，`bitflags` 的最高版本为 `1.2.1`，那么该包将使用 `1.2.1`，因为它是在兼容性范围内最高的版本。如果发布了 `2.0.0`，它仍然会使用 `1.2.1`，因为 `2.0.0` 被认为不兼容。


### SemVer 兼容性

Cargo 假设包遵循 [SemVer] 规范，如果依赖版本符合 [Caret 版本要求]，则会将依赖版本统一。如果由于版本要求冲突而无法统一两个兼容版本，Cargo 将会报错。

关于什么是“兼容”更改的指南，请参见 [SemVer Compatibility] 章节。

Examples:

以下两个包将统一其对 `bitflags` 的依赖，因为任意选择的版本都彼此兼容。
```toml
# Package A
[dependencies]
bitflags = "1.0"  # meaning `>=1.0.0,<2.0.0`

# Package B
[dependencies]
bitflags = "1.1"  # meaning `>=1.1.0,<2.0.0`
```

以下包将会报错，因为版本要求存在冲突，需要选择两个不同的兼容版本。
```toml
# Package A
[dependencies]
log = "=0.4.11"

# Package B
[dependencies]
log = "=0.4.8"
```

以下两个包不会统一其对 `rand` 的依赖，因为每个包只有不兼容的版本可用。相反，将解决并构建两个不同的版本（例如 0.6.5 和 0.7.3）。这可能导致问题，更多细节请参见 [Version-incompatibility hazards] 部分。
```toml
# Package A
[dependencies]
rand = "0.7"  # meaning `>=0.7.0,<0.8.0`

# Package B
[dependencies]
rand = "0.6"  # meaning `>=0.6.0,<0.7.0`
```

通常，以下两个包不会实现依赖统一，因为存在满足版本要求的不兼容版本。相反，会解决并构建两个不同的版本（例如 0.6.5 和 0.7.3）。其他约束或启发式规则可能导致这些版本被统一，选择其中一个版本（例如 0.6.5）。
```toml
# Package A
[dependencies]
rand = ">=0.6,<0.8.0"

# Package B
[dependencies]
rand = "0.6"  # meaning `>=0.6.0,<0.7.0`
```


#### Version-incompatibility hazards

当某个包出现多个版本时，使用这些包的类型会被依赖它们的其他包所暴露。这是因为即使名称相同，Rust 编译器也会认为这些类型和项目是不同的。库在发布不兼容的 SemVer 版本时应特别小心（例如，在 `1.0.0` 已经使用之后再发布 `2.0.0`），尤其是那些被广泛使用的库。

“[semver trick]”是一种解决在发布破坏性变更的同时保持与旧版本兼容问题的办法。相关链接页面详细介绍了问题所在及解决方法。简而言之，当库想要发布一个破坏性的 SemVer 版本时，应先发布新版本，并同时发布上一个版本的点发布版本，以重新导出来自新版本的类型。

这些不兼容性通常表现为编译时错误，但有时仅表现为运行时异常行为。例如，假设有一个名为 `foo` 的通用库在 resolve 图中同时出现 `1.0.0` 和 `2.0.0` 版本。如果在使用 `1.0.0` 版本的库创建的对象上使用了 [`downcast_ref`），而调用 `downcast_ref` 的代码将对象降级为 `2.0.0` 版本的类型，那么这种降级将在运行时失败。

确保正确使用多个版本的库非常重要，尤其是当不同版本的类型可以一起使用时。可以使用 [`cargo tree -d`][`cargo tree`]`命令来识别重复版本及其来源。同样，如果你发布了一个与 SemVer 不兼容的流行库版本，也需要考虑对生态系统的影响。


### Lock file Cargo 在使用时给予 [`Cargo.lock` 文件]中的版本最高优先级。这是为了平衡可复现构建与适应清单变化之间的关系。

使用时，Cargo 会给予 [`Cargo.lock` 文件]中版本最高的优先级。这样做旨在在可复现构建与适应清单变更之间取得平衡。

例如，如果你在解析图中有一个包如下：
```toml
[dependencies]
bitflags = "*"
```
如果生成 `Cargo.lock` 文件时，`bitflags` 的最高版本为 `1.2.1`，则该包将使用 `1.2.1` 并记录在 `Cargo.lock` 文件中。

当 Cargo 下次运行时，`bitflags` 已升级到 `1.3.5`。在解析依赖关系时，仍然会使用 `1.2.1`，因为它存在于你的 `Cargo.lock` 文件中。

然后该包会被修改为：
```toml
[dependencies]
bitflags = "1.3.0"
```
`bitflags` `1.2.1` 不符合此版本要求，因此 `Cargo.lock` 文件中的该条目被忽略，现在将使用并记录版本 `1.3.5`。

### Rust 版本 为了支持使用最低支持的 [Rust 版本]开发软件，解析器可以考虑依赖版本与你的 Rust 版本的兼容性。这由配置字段 [`resolver.incompatible-rust-versions`]控制。

为了支持使用最低支持的 [Rust 版本] 开发软件，解析器可以考虑依赖版本与你的 Rust 版本的兼容性。这一设置由配置字段 [`resolver.incompatible-rust-versions`]控制。

在 `fallback` 设置下，解析器会优先选择 Rust 版本小于或等于你自身 Rust 版本的包。例如，当你使用 Rust 1.85 开发以下包时：
```toml
[package]
name = "my-cli"
rust-version = "1.62"

[dependencies]
clap = "4.0"  # resolves to 4.0.32
```
解析器会选择 4.0.32 版本，因为该版本对应的 Rust 版本为 1.60.0。不选择 4.0.0 版本是因为它虽然也有 Rust 版本 1.60.0，但版本号较低。也不选择 4.5.20 版本，因为尽管其版本号较高，且拥有 1.74.0 的 Rust 版本与您的 1.85 工具链兼容，但它与 `my-cli` 的 1.62 版本不兼容。

如果版本要求中未包含兼容的依赖版本，解析器不会报错，而是会选择一个版本，即使该版本可能不够理想。例如，您更改了 `clap` 的依赖：
```toml
[package]
name = "my-cli"
rust-version = "1.62"

[dependencies]
clap = "4.2"  # resolves to 4.5.20
```
没有任何 `clap` 版本符合与 Rust 版本 1.62 兼容的 [版本要求](#version-requirements)。因此，解析器会选择不兼容的版本，如 4.5.20，尽管该版本的 Rust 版本为 1.74。

当解析器选择某个包的依赖版本时，它并不了解所有最终使用该版本的workspace 成员是否有传递依赖，因此无法仅考虑与该依赖相关的 Rust 版本。解析器使用启发式算法来寻找“足够好”的解决方案，当 工作区 成员具有不同的 Rust 版本时尤其如此。即使是在没有 Rust 版本的包中也是如此。

当 工作区 中的成员具有不同的 Rust 版本时，解析器可能会选择比必要更低的依赖版本。例如，您有以下 工作区 成员：
```toml
[package]
name = "a"
rust-version = "1.62"

[package]
name = "b"

[dependencies]
clap = "4.2"  # resolves to 4.5.20
```
尽管包 `b` 没有 Rust 版本且可以使用更高版本的如 4.5.20，但由于包 `a` 的 Rust 版本为 1.62，因此将选择 4.0.32 版本。

或者，解析器可能会选择过高的版本。例如，您有以下 工作区 成员：
```toml
[package]
name = "a"
rust-version = "1.62"

[dependencies]
clap = "4.2"  # resolves to 4.5.20

[package]
name = "b"

[dependencies]
clap = "4.5"  # resolves to 4.5.20
```
尽管每个包对于 `clap` 都有符合其自身 Rust 版本的版本要求，但由于 [版本统一](#version-numbers)，解析器需要选择一个在两种情况下都适用的版本，即像 4.5.20 这样的版本。


### 发布时间限制

那些发布时间早于配置的 [`min-publish-age`] 的版本被视为 pubtime-incompatible。当 [`resolver.incompatible-publish-age`] 设置为 `deny` 时，解析器将忽略这些版本，除非它们已存在于 `Cargo.lock` 文件中。将配置设为 `allow` 则会禁用此检查，结合使用 `cargo update --precise` 后，cargo 将会下载特定版本及其传递依赖项。


### 功能特性

为了生成 `Cargo.lock`，解析器会构建依赖图，假设所有 [工作空间] 成员的所有 [功能] 均被启用。这确保了任何可选依赖项在添加或移除 [`--features` 命令行标志](features.md#command-line-特性-options) 的功能时都能与图中的其他部分正确解决。解析器会再次运行以确定在 *编译* 一个 crate 时实际使用的功能，这些功能基于命令行上选择的选项。

依赖项会根据其启用的所有功能的并集来被解决。例如，如果一个包依赖于启用了 [`im`] 包的 [`serde` 依赖项]，而另一个包则依赖于启用了 [`rayon` 依赖项] 的 `im`，那么 `im` 将会在启用这两个功能的情况下构建，并且 `serde` 和 `rayon` crates 也会被包含进解决图中。如果没有包以这些功能依赖 `im`，那么这些可选依赖项将被忽略，不会影响依赖解析。

当在工作区中构建多个包时（例如使用 `--workspace` 或多个 `-p` 标志），所有这些包的依赖项特性会被统一。如果您希望避免不同工作区成员之间的特性统一，则需要通过单独的 `cargo` 调用来构建它们。

解析器会跳过缺少必要特性的包版本。例如，如果一个包依赖于 [`regex`] 的版本 `^1` 并包含 [`perf`] 特性，那么它可以选择的最早版本是 `1.3.0`，因为之前的版本不包含 `perf` 特性。同样，如果某个特性在新版本中被移除，那么需要该特性的包将只能使用包含该特性的旧版本。不推荐在符合 SemVer 标准的版本中移除特性。请注意，可选依赖项也定义了一个隐含的特性，因此移除可选依赖项或将其变为非可选依赖项可能会导致问题，请参阅 [移除可选依赖项]。


#### 特性解析器版本 2

当在 `Cargo.toml` 中指定 `resolver = "2"`（请参阅下面的 [解析器版本](#resolver-versions））时，会使用不同的特性解析器，该解析器采用不同的算法来统一特性。版本 `"1"` 解析器会无论包在哪里定义，都统一其特性。而版本 `"2"` 解析器会在以下情况下避免统一特性：

* 如果目标尚未构建，则针对目标特定依赖项的特性不会被启用。例如：

  ```toml
  [dependencies.common]
  version = "1.0"
  features = ["f1"]

  [target.'cfg(windows)'.dependencies.common]
  version = "1.0"
  features = ["f2"]
  ```

  当为非 Windows 平台构建此示例时，`f2` 特性将不会被启用。

* 在 [build-dependencies] 或 proc-macros 中启用的特性，当这些依赖项作为普通依赖项使用时不会统一。例如：

  ```toml
  [dependencies]
  log = "0.4"

  [build-dependencies]
  log = {version = "0.4", features=['std']}
  ```

  在构建构建脚本时，`log` crate 会启用 `std` 特性进行编译。但当构建你的包的库时，则不会启用该特性。

* 在 [dev-dependencies] 中启用的特性，当这些依赖项作为普通依赖项使用时不会统一，除非这些 dev-dependencies 正在被编译。例如：

  ```toml
  [dependencies]
  serde = {version = "1.0", default-features = false}

  [dev-dependencies]
  serde = {version = "1.0", features = ["std"]}
  ```

  在这个示例中，库通常会不启用 `std` 特性而链接 `serde`。然而，在作为测试或示例构建时，它会包含 `std` 特性。例如，`cargo test` 或 `cargo build --all-targets` 会统一这些特性。请注意，依赖项中的 dev-dependencies 总是被忽略，这仅适用于顶级包或工作空间成员。


### `links`

[`links` 字段] 用于确保二进制文件只链接一份原生库。解析器会尝试找到一个图结构，其中每个 `links` 名称只有一次实例。如果无法找到满足该约束的图结构，则会返回错误。

例如，如果一个包依赖 `libgit2-sys` 版本 `0.11`，而另一个包依赖 `0.12`，则会产生错误，因为 Cargo 无法统一这两个版本，但两者都链接到 `git2` 原生库。由于这一要求，如果您的库被广泛使用，在使用 `links` 字段发布与 SemVer 不兼容的版本时，建议非常小心。


### Yanked versions

[yank] 发布是指被标记为不应使用的发布版本。当解析器构建依赖图时，它会忽略所有 yank 的发布版本，除非这些版本已存在于 `Cargo.lock` 文件中或通过 [`--precise`] 标志的 `cargo update` 明确请求。


## 依赖项更新

所有需要了解依赖图的 Cargo 命令都会自动执行依赖解析。例如，`[cargo build]` 会运行解析器以发现构建所需的所有依赖项。第一次运行时，结果会被存储到 `Cargo.lock` 文件中。后续命令将再次运行解析器，并尽可能保持依赖项与 `Cargo.lock` 中的版本一致。

如果 `Cargo.toml` 中的依赖列表被修改，例如将某个依赖项的版本从 `1.0` 更改为 `2.0`，则解析器会为该依赖项选择一个新的版本以满足新的需求。如果该新依赖项引入了新的需求，这些新需求也可能触发额外的更新。`Cargo.lock` 文件将会更新为新的结果。可以使用 `--locked` 或 `--frozen` 标志来改变此行为，以防止在需求变更时自动更新，并返回错误。

[`cargo update`] 可用于在新版本发布时更新 `Cargo.lock` 中的条目。如果不指定任何选项，它将尝试更新锁定文件中的所有包。`-p` 标志可用于针对特定包进行更新，其他标志如 `--recursive` 或 `--precise` 可用于控制版本的选择方式。


## 覆盖

Cargo 有几种机制可以在依赖图中覆盖依赖项。[Overriding Dependencies] 章节详细介绍了如何使用覆盖功能。覆盖项会作为叠加层出现在注册表中，用新的条目替换已修补的版本。否则，解析过程则像正常情况一样进行。


## 依赖类型

在包中存在三种依赖类型：普通依赖、[build] 依赖和 [dev][dev-dependencies] 依赖。从解析器的角度来看，这些类型通常被视为相同。不同之处在于，非工作空间成员的 dev-dependencies 总是被忽略，不会影响依赖解析。

带有 `[target]` 表的[平台特定依赖]会在所有平台都启用时按预期进行解析。换句话说，解析器会忽略平台或 `cfg` 表达式。


### dev-依赖 循环

通常解析器不允许图中存在循环，但允许 [dev-dependencies] 中的循环。例如，项目“foo”有一个对“bar”的 dev-依赖，而“bar”又有对“foo”的普通依赖（通常是“路径”依赖）。这是允许的，因为从构建产物的角度来看实际上并没有循环。在这个例子中，“foo”库被构建（不需要“bar”，因为“bar”仅用于测试），然后“bar”可以根据“foo”进行构建，接着“foo”的测试就可以链接到“bar”来运行。

需要注意的是，这可能会导致混淆的错误。在构建库单元测试时，最终测试二进制实际上包含两个副本的库：一个与“bar”链接的版本，以及一个包含单元测试的版本。类似于[版本不兼容风险]部分中强调的问题，这两个版本之间的类型并不兼容。在这种情况下，当从“bar”中暴露“foo”的类型时，要小心，因为“foo”单元测试不会像本地类型那样对待这些类型。

如果可能的话，尝试将你的包拆分为多个包，并重新结构化，使其严格保持无循环状态。

## 解析器版本

可以通过 `Cargo.toml` 中的解析器版本指定不同的解析器行为，例如：

```toml
[package]
name = "my-package"
version = "1.0.0"
resolver = "3"
```
- `"1"`（默认）- `"2"`（[`edition = "2021"`](清单.md#the-edition-field) 默认）：引入了 [特性 unification](#features) 方面的变更。更多细节请参见 [features chapter][features-2]。
- `"3"`（[`edition = "2024"`](清单.md#the-edition-field) 默认，需 Rust 1.84+ 以上版本）：将 [`resolver.incompatible-rust-versions`] 的默认设置从 `allow` 更改为 `fallback`

Resolver 是一个全局选项，会影响整个工作空间。依赖项中的 `resolver` 版本会被忽略，仅使用顶层包中的值。如果使用 [虚拟工作空间]，则应在 `[workspace]` 表中指定版本，例如：

```toml
[workspace]
members = ["member1", "member2"]
resolver = "3"
```

> **MSRV:** - `"2"` 需要 Rust 1.51+ - `"3"` 需要 Rust 1.84+ 以上版本


## 建议

以下是关于在包中设置版本以及指定依赖要求的一些建议。这些为一般准则，适用于常见情况，但某些情况可能需要指定特殊的要求。

* 在决定如何更新版本号以及是否需要进行与 SemVer 不兼容的版本变更时，请遵循 [SemVer 指南]。
* 大多数情况下，应使用尖括号格式表示依赖项版本，例如 `"1.2.3"`。这样可确保解析器在选择版本时能够具有最大的灵活性，同时保持构建兼容性。
* 用当前使用的版本来指定这三个组件。这有助于设定使用的最低版本标准，并确保其他用户不会获得缺少包所需功能的旧版依赖项。
* 避免使用 `*` 格式的要求，因为这在 [crates.io] 上是不允许的，且正常执行 `cargo update` 时可能会引入破坏 SemVer 标准的变更。
* 避免使用过于宽泛的版本要求。例如，`>=2.0.0` 可能会引入任何与 SemVer 不兼容的版本，如版本 `5.0.0`，这可能会导致未来的构建失败。
* 如果可能的话，避免使用过于狭窄的版本要求。例如，如果你指定了波浪号格式的要求如 `bar="~1.3"，而另一个包则指定了 `bar="1.4"` 的要求，即使次要版本应该是兼容的，也会无法解决。
* 尽量将依赖项版本更新为你的库实际所需的最低版本。例如，如果你有 `bar="1.0.12"` 的要求，而在未来的发布中开始使用 `bar` 的 `1.1.0` 版本新增的功能，请将依赖项要求更新为 `bar="1.1.0"`。

  如果你没有执行此操作，可能不会立即显现出来，因为当你使用 `cargo update` 时，Cargo 会随机选择最新版本。然而，如果其他用户依赖你的库并运行 `cargo update your-library`，如果该库被锁定在他们的 `Cargo.lock` 中，它就不会自动更新“bar”。只有在依赖声明也更新的情况下，才会更新“bar”。如果不这样做，使用 `cargo update your-library` 的用户可能会遇到令人困惑的构建错误。* 如果两个包紧密耦合，使用 `=` 依赖要求可以帮助确保它们保持同步。例如，一个包含配套proc-macro库的库有时会在这两个库之间做出假设，如果它们不同步则会导致问题（而且通常不允许独立使用这两个库）。父库可以在proc-macro上使用 `=` 要求，并重新导出这些宏以便轻松访问。* `0.0.x` 版本可用于永久不稳定的包。

一般来说，你的依赖要求越严格，解析器失败的可能性就越高。相反地，如果你使用的要求太宽松，可能会发布新的版本导致构建失败。


## 故障排除

以下说明了你可能遇到的一些问题及可能的解决方案。

### 为什么包含依赖项？

假设你在 `cargo check` 输出中看到依赖项 `rand`，但认为不需要，并希望了解为何它被引入。

你可以运行
```console
$ cargo tree --workspace --target all --all-features --invert rand
rand v0.8.5
└── ...

rand v0.8.5
└── ...
```

### 为什么这个依赖项的某个功能被启用？

你可能会发现是一个激活的功能导致了 `rand` 的出现。**要找出是哪个包激活了该功能，可以添加 `--edges features` 参数**
```console
$ cargo tree --workspace --target all --all-features --edges features --invert rand
rand v0.8.5
└── ...

rand v0.8.5
└── ...
```

### 意外的依赖项重复

当你运行时看到多个 `rand` 实例。
```console
$ cargo tree --workspace --target all --all-features --duplicates
rand v0.7.3
└── ...

rand v0.8.5
└── ...
```

解析器算法已经收敛到一种解决方案，其中包含两个版本的依赖项而实际上只需要一个。例如：

```toml
# Package A
[dependencies]
rand = "0.7"

# Package B
[dependencies]
rand = ">=0.6"  # note: open requirements such as this are discouraged
```

在这个示例中，即使单个版本为 `0.7.3` 的 `rand` crate副本就能满足所有要求，Cargo 仍会构建两个该 crate的副本。这是因为解析器算法倾向于为 包 B 构建最新可用的 `rand` 版本，即本写作时的 `0.8.5`，而此版本与 包 A 的规范不兼容。目前解析器算法不会尝试在这种情况下进行“去重”操作。

在 Cargo 中不建议使用像 `>=0.6` 这样的开放式版本要求。但如果你遇到这种情况，可以使用 [`cargo update`] 命令并添加 `--precise` 标志来手动移除这些重复项。


### 为什么没有选择更新版本？

假设你在运行以下命令时注意到某个依赖项的最新版本没有被选中：
```console
$ cargo update
```
你可以启用额外的日志功能以查看发生原因：
```console
$ env CARGO_LOG=cargo::resolver=trace cargo update
```

> [!NOTE]
> Cargo log 的目标和级别可能会随时间变化。

### SemVer 破坏性补丁发布导致构建失败

有时项目可能会无意中发布带有 SemVer 破坏性变化的点版本。当用户使用 `cargo update` 进行更新时，他们会采用这个新版本，然后他们的构建可能就会失败。在这种情况下，建议项目 [撤销] 该发布，并要么移除 SemVer 破坏性变化，要么将其作为新的 SemVer 主版本升级发布。

如果更改发生在第三方项目中，如果可能的话，请尝试与该项目友好地合作解决此问题。

在等待发布被撤销期间，根据具体情况可能需要采用一些变通方法：

* 如果您的项目是最终产品（例如二进制可执行文件），只需避免在 `Cargo.lock` 中更新有问题的依赖包。可以通过在 [`cargo update`] 中使用 `--precise` 标志来实现。
* 如果您在 [crates.io] 上发布二进制文件，则可以临时添加 `=` 要求，以强制依赖使用特定版本。
* 二进制项目也可以建议用户使用 [`cargo install`] 中的 `--locked` 标志，从而使用包含已知良好版本的原始 `Cargo.lock`。
* 库也可以考虑发布带有更严格要求的临时新版本，以避免麻烦的依赖问题。您可能希望考虑使用范围要求（而非 `=`），以避免过于严格的要求与其他使用相同依赖的包产生冲突。一旦问题得到解决，您可以发布另一个点版本，将依赖要求恢复为 caret 要求。
* 如果第三方项目无法或不愿意撤回发布，一种选择是更新您的代码以与更改兼容，并将依赖要求设置到新版本的最低版本。您还需要考虑这是否属于您库中的 SemVer 版本变更，例如如果它暴露了来自依赖的类型。

[`Cargo.lock` file]: ../guide/cargo-toml-vs-cargo-lock.md
[dependency specifications]: specifying-dependencies.md
[dependency specification]: specifying-dependencies.md
[`cargo tree`]: ../commands/cargo-tree.md
[version requirements]: specifying-dependencies.md#version-requirement-syntax
[SemVer]: https://semver.org/
[SemVer Compatibility]: semver.md
[Caret version requirements]: specifying-dependencies.md#default-requirements
[Version-incompatibility hazards]: #version-incompatibility-hazards
[semver trick]: https://github.com/dtolnay/semver-trick
[`downcast_ref`]: ../../std/any/trait.Any.html#method.downcast_ref
[Rust version]: rust-version.md
[`resolver.incompatible-rust-versions`]: config.md#resolverincompatible-rust-versions
[`registry.global-min-publish-age`]: config.md#registryglobal-min-publish-age
[`resolver.incompatible-publish-age`]: config.md#resolverincompatible-publish-age
[`im`]: https://crates.io/crates/im
[`perf` feature]: https://github.com/rust-lang/regex/blob/1.3.0/Cargo.toml#L56
[`rayon` dependency]: https://github.com/bodil/im-rs/blob/v15.0.0/Cargo.toml#L47
[`regex`]: https://crates.io/crates/regex
[`serde` dependency]: https://github.com/bodil/im-rs/blob/v15.0.0/Cargo.toml#L46
[features]: features.md
[removing an optional dependency]: semver.md#cargo-remove-opt-dep
[workspace]: workspaces.md
[build-dependencies]: specifying-dependencies.md#build-dependencies
[dev-dependencies]: specifying-dependencies.md#development-dependencies
[resolver-field]: features.md#resolver-versions
[`links` field]: manifest.md#the-links-field
[`libgit2-sys`]: https://crates.io/crates/libgit2-sys
[yank]: publishing.md#cargo-yank
[`--precise`]: ../commands/cargo-update.md#option-cargo-update---precise
[`cargo build`]: ../commands/cargo-build.md
[`cargo update`]: ../commands/cargo-update.md
[Overriding Dependencies]: overriding-dependencies.md
[build]: specifying-dependencies.md#build-dependencies
[dev-dependencies]: specifying-dependencies.md#development-dependencies
[Platform-specific dependencies]: specifying-dependencies.md#platform-specific-dependencies
[virtual workspace]: workspaces.md#virtual-workspace
[features-2]: features.md#feature-resolver-version-2
[SemVer guidelines]: semver.md
[crates.io]: https://crates.io/
[`cargo update`]: ../commands/cargo-update.md
[`cargo install`]: ../commands/cargo-install.md
