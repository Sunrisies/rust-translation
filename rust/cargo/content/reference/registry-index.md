# 索引格式

以下定义了索引的格式。偶尔会添加新功能，但只有引入这些功能的 Cargo 版本才能理解它们。旧版本的 Cargo 可能无法使用包含新功能的包。不过，旧版本的包格式不应改变，因此旧版本的 Cargo 应该能够使用它们。

## 索引配置 索引的根目录包含一个名为 `config.json` 的文件，其中包含了 Cargo 访问注册表所使用的 JSON 信息。以下是 [crates.io] 配置文件的一个示例：

```javascript
{
    "dl": "https://crates.io/api/v1/crates",
    "api": "https://crates.io"
}
```

键包括：- `dl`：这是下载索引中列出的包的 URL。值可能包含以下标记，这些标记将被替换为对应的值。

  - `{crate}`：包的名称。
- `{version}`：包版本。
- `{prefix}`：从包名称计算出的目录前缀。例如，名为 `cargo` 的包具有 `ca/rg` 的前缀。详情请参见下文。
- `{lowerprefix}`：`{prefix}` 的小写形式。
- `{sha256-checksum}`：包的 sha256 校验和。

  如果不存在任何标记，则会在末尾添加 `/{crate}/{version}/download`。 - `api`：这是网络 API的基础 URL。此键是可选的，但如果未指定，则诸如 [`cargo publish`] 之类的命令将无法使用。网络 API的描述如下。该 URL 不应包含尾斜杠。 - `auth-required`：表示这是一个私有注册表，所有操作都需要进行认证，包括 API 请求、包下载和稀疏索引更新。


## 下载端点 下载端点应发送所请求包的 `.crate` 文件。Cargo 支持 https、http 和文件 URL、HTTP 重定向、HTTP1 和 HTTP2。TLS 支持的具体细节取决于 Cargo 运行的平台、Cargo 版本以及编译方式。

如果 `config.json` 中设置了 `auth-required: true`，则会在 http(s) 下载请求中包含 `Authorization` 头。

## 索引文件 索引仓库的其余部分包含每个包的一个文件，文件名即为包的名称的小写形式。每个版本的包在文件中都有单独的一行。这些文件按层级目录组织：

- 名称为1个字符的包被放在名为 `1` 的目录中。
- 名称为2个字符的包被放在名为 `2` 的目录中。
- 名称为3个字符的包被存放在 `3/{第一个字符}` 目录中，其中 `{第一个字符}` 是包名称的第一个字符。
- 所有其他包的存储位置为 `{第一个两个字符}/{第二个两个字符}` 目录，其中顶层目录是包名称的前两个字符，下一个子目录是包名称的第三和第四个字符。例如，`cargo` 会被存储在名为 `ca/rg/cargo` 的文件中。

> [!NOTE]
> 尽管索引文件名是小写形式，但 `Cargo.toml` 中的包名字段和索引 JSON 数据则是大小写敏感的，可能包含大写和小写字符。

上述目录名称是根据转换为小写的包名称计算得出的；它由标记 `{lowerprefix}` 表示。当使用原始包名称而不进行大小写转换时，得到的目录名称由标记 `{prefix}` 表示。例如，包 `MyCrate` 的 `{prefix}` 为 `My/Cr`，`{lowerprefix}` 为 `my/cr`。通常建议使用 `{prefix}`，但两种选择各有优缺点。在大小写不敏感的文件系统中使用 `{prefix}` 会导致（无害但不够优雅）的目录别名现象。例如，`crate` 和 `CrateTwo` 的 `{prefix}` 值分别为 `cr/at` 和 `Cr/at`；这些在 Unix 机器上是不同的，但在 Windows 上则指向同一个目录。使用标准化大小写的目录可以避免别名问题，但在大小写敏感的文件系统中，支持缺乏 `{prefix}`/`{lowerprefix}` 的旧版 Cargo 版本较为困难。例如，nginx 重写规则可以轻松构造 `{prefix}，但无法通过大小写转换来构造 `{lowerprefix}`。

## 名称限制

注册中心应考虑对添加到其索引中的包名实施限制。Cargo本身允许使用任何[字母数字字符]、`-`或`_`字符的包名。[crates.io]则施加了自己的限制，包括以下内容：

- 仅允许ASCII字符。
- 仅允许字母数字字符、`-`和`_`字符。
- 第一个字符必须是字母。
- 不区分大小写的冲突检测。
- 防止`-`与 `_`之间的差异。
- 在特定长度范围内（最多64个字符）。
- 拒绝保留名，例如Windows特殊文件名如“nul”。

注册中心应考虑纳入类似的限制，并考虑其安全影响，例如[IDN同形异字攻击](https://en.wikipedia.org/wiki/IDN_homograph_attack)以及[UTR36](https://www.unicode.org/reports/tr36/)和[UTS39](https://www.unicode.org/reports/tr39/)中的其他问题。

## 版本唯一性

索引*必须*确保每个包的每个版本只出现一次。这包括忽略SemVer构建元数据。例如，索引中不得包含两个条目，一个版本为`1.0.7`，另一个为`1.0.7+extra`。

## JSON格式

包文件中的每一行都包含一个描述该包发布版本的JSON对象。以下是带有注释的格式化示例，以解释条目的格式。

```javascript
{
    // The name of the package.
    // This must only contain alphanumeric, `-`, or `_` characters.
    "name": "foo",
    // The version of the package this row is describing.
    // This must be a valid version number according to the Semantic
    // Versioning 2.0.0 spec at https://semver.org/.
    "vers": "0.1.0",
    // Array of direct dependencies of the package.
    "deps": [
        {
            // Name of the dependency.
            // If the dependency is renamed from the original package name,
            // this is the new name. The original package name is stored in
            // the `package` field.
            "name": "rand",
            // The SemVer requirement for this dependency.
            // This must be a valid version requirement defined at
            // https://doc.rust-lang.org/cargo/reference/specifying-dependencies.html.
            "req": "^0.6",
            // Array of features (as strings) enabled for this dependency.
            // Since Cargo 1.84, defaults to `[]` if not specified.
            "features": ["i128_support"],
            // Boolean of whether or not this is an optional dependency.
            // Since Cargo 1.84, defaults to `false` if not specified.
            "optional": false,
            // Boolean of whether or not default features are enabled.
            // Since Cargo 1.84, defaults to `true` if not specified.
            "default_features": true,
            // The target platform for the dependency.
            // If not specified or `null`, it is not a target dependency.
            // Otherwise, a string such as "cfg(windows)".
            "target": null,
            // The dependency kind.
            // "dev", "build", or "normal".
            // If not specified or `null`, it defaults to "normal".
            "kind": "normal",
            // The URL of the index of the registry where this dependency is
            // from as a string. If not specified or `null`, it is assumed the
            // dependency is in the current registry.
            "registry": null,
            // If the dependency is renamed, this is a string of the actual
            // package name. If not specified or `null`, this dependency is not
            // renamed.
            "package": null,
        }
    ],
    // A SHA256 checksum of the `.crate` file.
    "cksum": "d867001db0e2b6e0496f9fac96930e2d42233ecd3ca0413e0753d4c7695d289c",
    // Set of features defined for the package.
    // Each feature maps to an array of features or dependencies it enables.
    // Since Cargo 1.84, defaults to `{}` if not specified.
    "features": {
        "extras": ["rand/simd_support"]
    },
    // Boolean of whether or not this version has been yanked.
    "yanked": false,
    // The `links` string value from the package's manifest, or null if not
    // specified. This field is optional and defaults to null.
    "links": null,
    // An unsigned 32-bit integer value indicating the schema version of this
    // entry.
    //
    // If this is not specified, it should be interpreted as the default of 1.
    //
    // Cargo (starting with version 1.51) will ignore versions it does not
    // recognize. This provides a method to safely introduce changes to index
    // entries and allow older versions of cargo to ignore newer entries it
    // doesn't understand. Versions older than 1.51 ignore this field, and
    // thus may misinterpret the meaning of the index entry.
    //
    // The current values are:
    //
    // * 1: The schema as documented here, not including newer additions.
    //      This is honored in Rust version 1.51 and newer.
    // * 2: The addition of the `features2` field.
    //      This is honored in Rust version 1.60 and newer.
    "v": 2,
    // This optional field contains features with new, extended syntax.
    // Specifically, namespaced features (`dep:`) and weak dependencies
    // (`pkg?/feat`).
    //
    // This is separated from `features` because versions older than 1.19
    // will fail to load due to not being able to parse the new syntax, even
    // with a `Cargo.lock` file.
    //
    // Cargo will merge any values listed here with the "features" field.
    //
    // If this field is included, the "v" field should be set to at least 2.
    //
    // Registries are not required to use this field for extended feature
    // syntax, they are allowed to include those in the "features" field.
    // Using this is only necessary if the registry wants to support cargo
    // versions older than 1.19, which in practice is only crates.io since
    // those older versions do not support other registries.
    "features2": {
        "serde": ["dep:serde", "chrono?/serde"]
    }
    // The minimal supported Rust version (optional)
    // This must be a valid version requirement without an operator (e.g. no `=`)
    "rust_version": "1.60",
    // The publish time of this package version (optional).
    //
    // The format is a subset of ISO8601:
    // - `yyyy-mm-ddThh:mm:ssZ`
    // - no fractional seconds
    // - always `Z` for UTC timezone, no timezone offsets supported
    // - fields are 0-padded
    //
    // Example: 2025-11-12T19:30:12Z
    //
    // This should be the original publish time and not changed on any status changes,
    // like `yanked`.
    "pubtime": "2025-11-12T19:30:12Z"
}
```

在添加后，JSON对象不应被修改，除了`yanked`字段，其值可以随时更改。

> [!IMPORTANT]
> 索引JSON格式与[Publish API]和 [`cargo metadata`]的JSON格式有细微差异。如果您使用其中一项作为生成索引条目的来源，建议仔细检查它们之间的文档差异。
>
> 对于[Publish API]，其差异包括：
>
> * `deps` * `name` --- 当依赖项在 `Cargo.toml` 中被[重命名]时，发布 API 会在 `name` 字段中保留原始包名，在 `explicit_name_in_toml` 字段中保留别名。索引会将别名放在 `name` 字段中，原始包名放在 `package` 字段中。 * `req` --- 发布 API 的字段称为 `version_req`。 * `cksum` --- 发布 API 未指定校验和，必须由注册表在加入索引前自行计算。 * `features` --- 某些功能可以放在 `features2` 字段中。注意：这仅是 [crates.io] 的遗留要求；其他注册表无需修改功能映射。 `v` 字段表示是否存在 `features2` 字段。 * 发布 API 还包含多个其他字段，如 `description` 和 `readme`，这些字段不会出现在索引中。这些字段旨在帮助注册表在不需要提取和解析 `.crate` 文件的情况下，轻松获取用于网站显示的包元数据。这些额外信息通常会被添加到注册表服务器的数据库中。 * 尽管这里包含了 `rust_version`，[crates.io] 会忽略该字段，而是从 `.crate` 文件中的 `Cargo.toml` 读取它。
>
> 对于 [`cargo metadata`]，其差异如下：
>
> * `vers` --- `cargo metadata` 字段被称为 `version`。 * `deps` * `name` --- 当依赖项在 `Cargo.toml` 中 [重命名] 时，`cargo metadata` 会在 `name` 字段中填入原始包名，在 `rename` 字段中填入别名。索引表中，`name` 字段包含别名，而 `package` 字段包含原始包名。 * `default_features` --- `cargo metadata` 字段被称为 `uses_default_features`。 * `registry` --- `cargo metadata` 使用 `null` 值表示该依赖项来自 [crates.io]。索引表也使用 `null` 值表示该依赖项来自与索引表相同的注册表。在创建索引条目时，非 [crates.io] 的注册表应将 `null` 值转换为 `https://github.com/rust-lang/crates.io-index`，并将与当前索引匹配的 URL 转换为 `null`。 * `cargo metadata` 包含一些额外字段，如 `source` 和 `path`。 * 索引表还包含其他字段，如 `yanked`、`cksum` 和 `v`。


## Index Protocols Cargo 支持两种远程注册表协议：`git` 和 `sparse`。`git` 协议将索引文件存储在 git 仓库中，而 `sparse` 协议则通过 HTTP 获取单个文件。

### Git Protocol 在索引 URL 中没有协议前缀。例如，[crates.io] 的 git 索引 URL 为 `https://github.com/rust-lang/crates.io-index`。

Cargo 将 git 仓库缓存到磁盘上，以便能够高效地逐步获取更新。

### Sparse Protocol 在注册表 URL 中使用 `sparse+` 协议前缀。例如，[crates.io] 的 sparse 索引 URL 为 `sparse+https://index.crates.io/`。

Sparse 协议通过单独的 HTTP 请求下载每个索引文件。由于这会产生大量小的 HTTP 请求，在支持管道和 HTTP/2 的服务器上，性能会显著提升。

#### 稀疏认证 在获取其他文件之前，Cargo会尝试获取 `config.json` 文件。如果服务器返回 HTTP 401 响应，则 Cargo将认为注册表需要认证，并包含认证令牌重新请求 `config.json` 文件。

在认证失败（或缺少认证令牌）时，服务器可能会添加 `www-authenticate` 标头及 `Cargo login_url="<URL>"` 挑战，以指示用户应前往何处获取令牌。

需要认证的注册表必须在 `config.json` 中设置 `auth-required: true`。

#### 缓存 Cargo会缓存库元数据文件，并为每个条目捕获来自服务器的 `ETag` 或 `Last-Modified` HTTP 标头。在刷新库元数据时，Cargo会发送 `If-None-Match` 或 `If-Modified-Since` 标头，使服务器可以在本地缓存有效时返回 HTTP 304 “未修改”响应，从而节省时间和带宽。如果同时存在 `ETag` 和 `Last-Modified` 标头，则 Cargo仅使用 `ETag`。

#### 缓存失效 如果注册表使用某种 CDN 或代理来缓存索引文件访问权限，建议注册表在文件更新时实现某种形式的缓存失效机制。如果这些缓存未更新，用户可能直到缓存被清除之前都无法访问新库。

#### 不存在的库 对于不存在的库，注册表应返回 404 “未找到”、410 “已删除”或 451 “因法律原因无法使用”代码。

#### 稀疏限制 由于注册表的 URL 存储在锁文件中，不建议同时提供两种协议。关于过渡计划的讨论正在 issue [#10964]中进行。[crates.io] 注册表是一个例外，因为当使用稀疏协议时，Cargo会在内部替换相应的 git URL。

如果注册表同时提供两种协议，目前建议选择一种协议作为标准协议，并对另一种协议使用 [source replacement]。

[renamed]: specifying-dependencies.md#renaming-dependencies-in-cargotoml
[Publish API]: registry-web-api.md#publish
[`cargo metadata`]: ../commands/cargo-metadata.md
[`cargo publish`]: ../commands/cargo-publish.md
[alphanumeric]: ../../std/primitive.char.html#method.is_alphanumeric
[crates.io]: https://crates.io/
[source replacement]: ../reference/source-replacement.md
[#10964]: https://github.com/rust-lang/cargo/issues/10964
