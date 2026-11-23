# Web API

注册中心可以在 `config.json` 中定义的地址上托管 Web API，以支持以下列出的所有操作。

Cargo 为需要身份验证的请求包含 `Authorization` 请求头。该请求头的值即为 API 令牌。如果令牌无效，服务器应返回 403 响应代码。用户需访问注册中心的网站以获取令牌，而 Cargo 可以通过 [`cargo login`] 命令或直接在命令行中传递令牌来保存令牌。

成功操作使用 2xx 响应代码。错误情况应使用适当的响应代码，例如 404。失败响应应包含具有以下结构的 JSON 对象：

```javascript
{
    // Array of errors to display to the user.
    "errors": [
        {
            // The error message as a string.
            "detail": "error message text"
        }
    ]
}
```

如果响应具有此结构，即使响应代码为 200，Cargo 也会向用户显示详细消息。如果响应代码表示错误且内容没有此结构，Cargo 会向用户显示有助于调试服务器错误的消息。返回 `errors` 对象的服务器允许注册中心提供更详细的或以用户为中心的错误消息。

为了向后兼容，服务器应忽略任何意外的查询参数或 JSON 字段。如果某个 JSON 字段缺失，应假设其值为 null。端点通过路径中的 `v1` 组件进行版本化，且 Cargo 负责处理未来可能出现的向后兼容性回退方案。

Cargo 为所有指向自身版本的请求设置 `User-Agent` 请求头，例如 `cargo/1.32.0 (8610973aa 2019-01-02)`。用户可以通过配置值修改此值。该功能在 1.29 版本中新增。

其他请求头因端点不同而有所差异，具体说明见下文。

## 发布

- 端点： `/api/v1/crates/new` - 方法：PUT - 认证：包含 - 请求头：
- `Content-Type`: `application/octet-stream` - `Accept`: `application/json` - 主体：包含（见下文）

发布端点用于发布新版本的 crate。服务器应验证 crate，使其可供下载，并将其添加到索引中。

在成功发送响应之前，无需更新索引。成功发送响应后，Cargo 会短暂轮询索引，以确认新 crate 已添加。如果短时间内该 crate 未出现在索引中，则 Cargo 会显示警告，告知用户该新 crate 尚未可用。

Cargo 发送的数据内容如下：

- JSON 数据长度的 32 位无符号小端整数。
- 作为 JSON 对象的包元数据。
- `.crate` 文件长度对应的 32 位无符号小端整数。
- `.crate` 文件本身。

以下是 JSON 对象的注释示例。其中一些 [crates.io] 施加的限制说明仅用于说明可能进行的验证类型建议，不应被视为 [crates.io] 所施加的所有限制的完整列表。

```javascript
{
    // The name of the package.
    "name": "foo",
    // The version of the package being published.
    "vers": "0.1.0",
    // Array of direct dependencies of the package.
    "deps": [
        {
            // Name of the dependency.
            // If the dependency is renamed from the original package name,
            // this is the original name. The new package name is stored in
            // the `explicit_name_in_toml` field.
            "name": "rand",
            // The semver requirement for this dependency.
            "version_req": "^0.6",
            // Array of features (as strings) enabled for this dependency.
            "features": ["i128_support"],
            // Boolean of whether or not this is an optional dependency.
            "optional": false,
            // Boolean of whether or not default features are enabled.
            "default_features": true,
            // The target platform for the dependency.
            // null if not a target dependency.
            // Otherwise, a string such as "cfg(windows)".
            "target": null,
            // The dependency kind.
            // "dev", "build", or "normal".
            "kind": "normal",
            // The URL of the index of the registry where this dependency is
            // from as a string. If not specified or null, it is assumed the
            // dependency is in the current registry.
            "registry": null,
            // If the dependency is renamed, this is a string of the new
            // package name. If not specified or null, this dependency is not
            // renamed.
            "explicit_name_in_toml": null,
        }
    ],
    // Set of features defined for the package.
    // Each feature maps to an array of features or dependencies it enables.
    // Cargo does not impose limitations on feature names, but crates.io
    // requires alphanumeric ASCII, `_` or `-` characters.
    "features": {
        "extras": ["rand/simd_support"]
    },
    // List of strings of the authors.
    // May be empty.
    "authors": ["Alice <a@example.com>"],
    // Description field from the manifest.
    // May be null. crates.io requires at least some content.
    "description": null,
    // String of the URL to the website for this package's documentation.
    // May be null.
    "documentation": null,
    // String of the URL to the website for this package's home page.
    // May be null.
    "homepage": null,
    // String of the content of the README file.
    // May be null.
    "readme": null,
    // String of a relative path to a README file in the crate.
    // May be null.
    "readme_file": null,
    // Array of strings of keywords for the package.
    "keywords": [],
    // Array of strings of categories for the package.
    "categories": [],
    // String of the license for the package.
    // May be null. crates.io requires either `license` or `license_file` to be set.
    "license": null,
    // String of a relative path to a license file in the crate.
    // May be null.
    "license_file": null,
    // String of the URL to the website for the source repository of this package.
    // May be null.
    "repository": null,
    // Optional object of "status" badges. Each value is an object of
    // arbitrary string to string mappings.
    // crates.io has special interpretation of the format of the badges.
    "badges": {
        "travis-ci": {
            "branch": "master",
            "repository": "rust-lang/cargo"
        }
    },
    // The `links` string value from the package's manifest, or null if not
    // specified. This field is optional and defaults to null.
    "links": null,
    // The minimal supported Rust version (optional)
    // This must be a valid version requirement without an operator (e.g. no `=`)
    "rust_version": null
}
```

成功响应包含 JSON 对象：

```javascript
{
    // Optional object of warnings to display to the user.
    "warnings": {
        // Array of strings of categories that are invalid and ignored.
        "invalid_categories": [],
        // Array of strings of badge names that are invalid and ignored.
        "invalid_badges": [],
        // Array of strings of arbitrary warnings to display to the user.
        "other": []
    }
}
```

## Yank

- 端点：/api/v1/crates/{crate_name}/{version}/yank - 方法：DELETE - 授权信息：已包含 - 请求头：
- `Accept`：`application/json` - 内容：无

yank 端点会将给定版本的 crate 的 `yank` 字段在索引中设置为 `true`。

成功响应包含 JSON 对象：

```javascript
{
    // Indicates the yank succeeded, always true.
    "ok": true,
}
```

## Unyank

- 端点：/api/v1/crates/{crate_name}/{version}/unyank - 方法：PUT - 授权信息：已包含 - 请求头：
- `Accept`：`application/json` - 内容：无

unyank 端点会将给定版本的 crate 的 `yank` 字段在索引中设置为 `false`。

成功响应包含 JSON 对象：

```javascript
{
    // Indicates the unyank succeeded, always true.
    "ok": true,
}
```

## Owners

Cargo 没有关于用户和拥有者的固有概念，但它提供了 `owner` 命令来协助管理谁有权控制一个 crate。如何处理用户和拥有者由注册表决定。有关 [crates.io] 如何通过 GitHub 用户和团队处理拥有者的情况，请参阅 [发布文档]。

### Owners：列表

- 端点：/api/v1/crates/{crate_name}/owners - 方法：GET - 授权：包含 - 请求头：
- `Accept`：`application/json` - 请求体：无

所有者端点返回该 crate 的所有者列表。

成功的响应包含 JSON 对象：

```javascript
{
    // Array of owners of the crate.
    "users": [
        {
            // Unique unsigned 32-bit integer of the owner.
            "id": 70,
            // The unique username of the owner.
            "login": "github:rust-lang:core",
            // Name of the owner.
            // This is optional and may be null.
            "name": "Core",
        }
    ]
}
```

### 所有者：添加

- 端点：/api/v1/crates/{crate_name}/owners - 方法：PUT - 授权：包含 - 请求头：
- `Content-Type`：`application/json` - `Accept`：`application/json` - 请求体：包含（见下文）

PUT 请求会向注册表发送请求以添加新所有者到 crate 中。注册表负责处理该请求的方式。例如，[crates.io] 会向用户发送邀请，用户必须接受该邀请才能被添加到其中。

请求应包含以下 JSON 对象：

```javascript
{
    // Array of `login` strings of owners to add.
    "users": ["login_name"]
}
```

成功的响应包含 JSON 对象：

```javascript
{
    // Indicates the add succeeded, always true.
    "ok": true,
    // A string to be displayed to the user.
    "msg": "user ehuss has been invited to be an owner of crate cargo"
}
```

### 所有者：移除

- 端点：/api/v1/crates/{crate_name}/owners - 方法：DELETE - 授权：包含 - 请求头：
- `Content-Type`：`application/json` - `Accept`：`application/json` - 请求体：包含（见下文）

DELETE 请求会移除 crate 中的某个所有者。请求应包含以下 JSON 对象：

```javascript
{
    // Array of `login` strings of owners to remove.
    "users": ["login_name"]
}
```

成功的响应包含 JSON 对象：

```javascript
{
    // Indicates the remove succeeded, always true.
    "ok": true
    // A string to be displayed to the user. Currently ignored by cargo.
    "msg": "owners successfully removed",
}
```

## 搜索

- 端点：/api/v1/crates - 方法：GET - 授权：不包含 - 请求头：
- `Accept`：`application/json` - 请求体：无 - 查询参数：
- `q`：搜索字符串 - `per_page`：结果数量，默认为 10，最大为 100。

搜索请求将使用服务器定义的条件对 crates 进行搜索。

成功的响应包含 JSON 对象：

```javascript
{
    // Array of results.
    "crates": [
        {
            // Name of the crate.
            "name": "rand",
            // The highest version available.
            "max_version": "0.6.1",
            // Textual description of the crate.
            "description": "Random number generators and other randomness functionality.\n",
        }
    ],
    "meta": {
        // Total number of results available on the server.
        "total": 119
    }
}
```

## 登录

- 端点：/me

“登录”端点并非实际的 API 请求。它仅用于 [`cargo login`] 命令，以显示 URL，指导用户通过网页浏览器访问该 URL 进行登录并获取 API 令牌。

[`cargo login`]: ../commands/cargo-login.md
[`cargo package`]: ../commands/cargo-package.md
[`cargo publish`]: ../commands/cargo-publish.md
[alphanumeric]: ../../std/primitive.char.html#method.is_alphanumeric
[config]: config.md
[crates.io]: https://crates.io/
[publishing documentation]: publishing.md#cargo-owner
