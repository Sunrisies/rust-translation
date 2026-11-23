# Cargo.toml 与 Cargo.lock 的区别

`Cargo.toml` 和 `Cargo.lock` 具有不同的用途。在讨论它们之前，先做一个总结：

* `Cargo.toml` 用于从宏观角度描述你的依赖项，由你自行编写。
* `Cargo.lock` 包含关于你的依赖项的精确信息，由 Cargo 维护，不应手动编辑。

如有疑问，请将 `Cargo.lock` 纳入版本控制系统（例如 Git）。要更好地理解其用途及替代方案，请参阅 [“为什么将 Cargo.lock 放入版本控制中？”](](../faq.md#why-have-cargolock-in-version-control) 中的常见问题解答。我们建议结合 [验证最新依赖项](continuous-integration.md#verifying-latest-dependencies) 来做此操作。

让我们进一步探讨一下。

`Cargo.toml` 是一个 [**清单**][def-清单] 文件，你可以在其中指定关于你的包的各种元数据。例如，你可以说明你依赖另一个包：

```toml
[package]
name = "hello_world"
version = "0.1.0"
edition = "2024"

[dependencies]
regex = { git = "https://github.com/rust-lang/regex.git" }
```

这个包有一个单一的依赖项，即 `regex` 库。在这种情况下，它表明你依赖于位于 GitHub 上的某个特定 Git 仓库。由于你没有提供其他信息，Cargo 假设你想使用默认分支上的最新提交来构建我们的包。

听起来不错？不过有个问题：如果你今天构建这个包，然后把副本发给我，明天我再构建这个包，可能会出现问题。在此期间，`regex` 可能会有更多提交，我的构建会包含新提交，而你的不会。因此，我们将得到不同的构建结果。这是不好的，因为我们希望构建能够可复现。

你可以通过在 `Cargo.toml` 中定义特定的 `rev` 值来解决这个问题，这样 Cargo 就能准确知道在构建包时应该使用哪个版本：

```toml
[dependencies]
regex = { git = "https://github.com/rust-lang/regex.git", rev = "9f9f693" }
```

现在我们的构建结果将相同。但有一个重大缺点：每次想要更新我们的库时，你都必须手动考虑 SHA-1 值。这既繁琐又容易出错。

输入 `Cargo.lock` 文件。由于它的存在，您无需手动记录具体的修订版本：Cargo 会为您完成此工作。当您拥有如下清单时：

```toml
[package]
name = "hello_world"
version = "0.1.0"
edition = "2024"

[dependencies]
regex = { git = "https://github.com/rust-lang/regex.git" }
```

Cargo 将获取最新提交，并在您首次构建时将这些信息写入您的 `Cargo.lock` 文件中。该文件看起来像这样：

```toml
[[package]]
name = "hello_world"
version = "0.1.0"
dependencies = [
 "regex 1.5.0 (git+https://github.com/rust-lang/regex.git#9f9f693768c584971a4d53bc3c586c33ed3a6831)",
]

[[package]]
name = "regex"
version = "1.5.0"
source = "git+https://github.com/rust-lang/regex.git#9f9f693768c584971a4d53bc3c586c33ed3a6831"
```

您可以看到这里包含大量信息，包括用于构建的具体修订版本。现在，当您将包交付给其他人时，即使您在 `Cargo.toml` 中未指定，他们也会使用完全相同的 SHA 值。

当您准备启用库的新版本时，Cargo 可以重新计算依赖项并为您更新相关设置：

```console
$ cargo update         # updates all dependencies
$ cargo update regex   # updates just “regex”
```

这将生成一个包含新版本信息的新的 `Cargo.lock` 文件。请注意，`cargo update` 的参数实际上是一个 [包 ID Specification](../reference/pkgid-spec.md)，而 `regex` 只是一个简短的规范名称。

[def-manifest]:  ../appendix/glossary.md#manifest  '"manifest" (glossary entry)'
[def-package]:   ../appendix/glossary.md#package   '"package" (glossary entry)'
