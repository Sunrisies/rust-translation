# 依赖项

[crates.io] 是 Rust 社区的中心[*包注册表*][def-包-registry]，作为发现和下载[包][def-包]的位置。`cargo` 默认配置为使用它来查找所需的包。

要依赖在 [crates.io] 上托管的库，请将该库添加到你的 `Cargo.toml` 文件中。


## 添加依赖项

如果你的 `Cargo.toml` 还没有 `[dependencies]` 部分，请添加它，然后列出你想要使用的[包][def-crate]名称和版本。这个示例添加了对 `time` 包的依赖：

```toml
[dependencies]
time = "0.1.12"
```

版本字符串是 [SemVer] 版本要求。[指定依赖项](../reference/specifying-dependencies.md) 文档提供了更多关于此选项的信息。


如果你还想添加对 `regex` 包的依赖，则不需要为每个列出的包添加 `[dependencies]`。以下是包含 `time` 和 `regex` 包依赖的整个 `Cargo.toml` 文件示例：

```toml
[package]
name = "hello_world"
version = "0.1.0"
edition = "2024"

[dependencies]
time = "0.1.12"
regex = "0.1.41"
```

重新运行 `cargo build`，Cargo 将获取新的依赖项及其所有依赖项，编译它们并更新 `Cargo.lock`：

```console
$ cargo build
      Updating crates.io index
   Downloading memchr v0.1.5
   Downloading libc v0.1.10
   Downloading regex-syntax v0.2.1
   Downloading memchr v0.1.5
   Downloading aho-corasick v0.3.0
   Downloading regex v0.1.41
     Compiling memchr v0.1.5
     Compiling libc v0.1.10
     Compiling regex-syntax v0.2.1
     Compiling memchr v0.1.5
     Compiling aho-corasick v0.3.0
     Compiling regex v0.1.41
     Compiling hello_world v0.1.0 (file:///path/to/package/hello_world)
```

`Cargo.lock` 包含关于所有这些依赖项所使用的版本的精确信息。

现在，如果 `regex` 被更新了，直到你选择运行 `cargo update` 之前，构建仍然会使用相同的版本。

你现在可以在 `main.rs` 中使用 `regex` 库了。

```rust,ignore
use regex::Regex;

fn main() {
    let re = Regex::new(r"^\d{4}-\d{2}-\d{2}$").unwrap();
    println!("Did our date match? {}", re.is_match("2014-01-01"));
}
```

运行它将会显示：

```console
$ cargo run
   Running `target/hello_world`
Did our date match? true
```

[crates.io]: https://crates.io/
[SemVer]: https://semver.org
[def-crate]:             ../appendix/glossary.md#crate             '"crate" (glossary entry)'
[def-package]:           ../appendix/glossary.md#package           '"package" (glossary entry)'
[def-package-registry]:  ../appendix/glossary.md#package-registry  '"package-registry" (glossary entry)'
