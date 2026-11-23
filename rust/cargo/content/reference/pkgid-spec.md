# 包 ID 规范

## 包 ID 规范

Cargo 的子命令经常需要在依赖图中引用特定的包以执行更新、清理、构建等操作。为了解决这个问题，Cargo 支持 *包 ID 规范*。规范是一个字符串，用于唯一地指代依赖图中的某个包。

规范可以是完全限定的，例如 `registry+https://github.com/rust-lang/crates.io-index#regex@1.4.3`，也可以缩写形式，例如 `regex`。只要能够唯一标识依赖图中单个包，就可以使用缩写形式。如果存在歧义，可以添加额外的限定符使其更加唯一。例如，如果依赖图中有两个版本的 `regex` 包，则可以加上版本号使其唯一，如 `regex@1.4.3`。

由 cargo 生成的包 ID 规范，例如在 [cargo metadata](../commands/cargo-metadata.md) 输出中，都是完全限定的。

### 规范语法

包 ID 规范的正式语法如下：

```notrust
spec := pkgname |
        [ kind "+" ] proto "://" hostname-and-path [ "?" query] [ "#" ( pkgname | semver ) ]
query = ( "branch" | "tag" | "rev" ) "=" ref
pkgname := name [ ("@" | ":" ) semver ]
semver := digits [ "." digits [ "." digits [ "-" prerelease ] [ "+" build ]]]

kind = "registry" | "git" | "path"
proto := "http" | "git" | "file" | ...
```

此处括号表示内容可选。

URL 形式可用于 git 依赖项，或者用于区分来自不同来源的包，例如不同的注册表。

### 示例规范

以下是 `crates.io` 上 `regex` 包的引用：

| Spec                                                              | Name    | Version |
|:------------------------------------------------------------------|:-------:|:-------:|
| `regex`                                                           | `regex` | `*`     |
| `regex@1.4`                                                       | `regex` | `1.4.*` |
| `regex@1.4.3`                                                     | `regex` | `1.4.3` |
| `https://github.com/rust-lang/crates.io-index#regex`              | `regex` | `*`     |
| `https://github.com/rust-lang/crates.io-index#regex@1.4.3`        | `regex` | `1.4.3` |
| `registry+https://github.com/rust-lang/crates.io-index#regex@1.4.3` | `regex` | `1.4.3` |

以下是几个不同 git 依赖项的规范示例：

| Spec                                                       | Name             | Version  |
|:-----------------------------------------------------------|:----------------:|:--------:|
| `https://github.com/rust-lang/cargo#0.52.0`                | `cargo`          | `0.52.0` |
| `https://github.com/rust-lang/cargo#cargo-platform@0.1.2`  | <nobr>`cargo-platform`</nobr> | `0.1.2`  |
| `ssh://git@github.com/rust-lang/regex.git#regex@1.4.3`     | `regex`          | `1.4.3`  |
| `git+ssh://git@github.com/rust-lang/regex.git#regex@1.4.3` | `regex`          | `1.4.3`  |
| `git+ssh://git@github.com/rust-lang/regex.git?branch=dev#regex@1.4.3` | `regex`          | `1.4.3`  |

文件系统中的本地包可以使用 `file://` URL 进行引用：

| Spec                                        | Name  | Version |
|:--------------------------------------------|:-----:|:-------:|
| `file:///path/to/my/project/foo`            | `foo` | `*`     |
| `file:///path/to/my/project/foo#1.1.8`      | `foo` | `1.1.8` |
| `path+file:///path/to/my/project/foo#1.1.8` | `foo` | `1.1.8` |

### 规范的简洁性

其目的是实现既简洁又全面的语法来引用依赖图中的包。模糊的引用可能指代一个或多个包。大多数命令会在同一规范下指向多个包时生成错误。
