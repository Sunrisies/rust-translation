# 凭证提供器协议 本文档描述了构建 Cargo 凭证提供器的信息。关于设置或使用凭证提供器的信息，请参阅 [注册表认证](registry-authentication.md)。

当使用外部凭证提供器时，Cargo 通过作为单行 JSON 传递的 stdin/stdout 消息与凭证提供器进行通信。

Cargo 总是使用 `--cargo-plugin` 参数执行凭证提供器。这使得凭证提供器可执行文件具有超出 Cargo 所需功能的额外功能。额外的参数通过 `args` 字段包含在 JSON 中。

## JSON 消息 本文档中的 JSON 消息添加了新行以便阅读。实际消息不得包含新行。

### 凭证问候语 * 发送者：凭证提供器 * 目的：用于在进程启动时识别支持的协议
```javascript
{
    "v":[1]
}
```

Cargo 发送的请求将包含一个 `v` 字段，其值设置为此处列出的版本之一。如果 Cargo 不支持凭证提供器提供的任何版本，它将发出错误并停止凭证处理过程。

### 注册表信息 * 发送者：Cargo 并非单独的消息。作为 `registry` 字段包含在 Cargo 发送的所有消息中。
```javascript
{
    // Index URL of the registry
    "index-url":"https://github.com/rust-lang/crates.io-index",
    // Name of the registry in configuration (optional)
    "name": "crates-io",
    // HTTP headers received from attempting to access an authenticated registry (optional)
    "headers": ["WWW-Authenticate: cargo"]
}
```

### 登录请求 * 发送者：Cargo * 目的：收集和存储凭证
```javascript
{
    // Protocol version
    "v":1,
    // Action to perform: login
    "kind":"login",
    // Registry information (see Registry information)
    "registry":{"index-url":"sparse+https://registry-url/index/", "name": "my-registry"},
    // User-specified token from stdin or command line (optional)
    "token": "<the token value>",
    // URL that the user could visit to get a token (optional)
    "login-url": "http://registry-url/login",
    // Additional command-line args (optional)
    "args":[]
}
```

如果设置了 `token` 字段，则凭证提供器应使用提供的令牌。如果未设置 `token`，则凭证提供器应提示用户输入令牌。

除了可以在配置中传递给凭证提供器的参数外，`cargo login` 还支持通过 `cargo login -- <额外参数>` 传递额外的命令行参数。这些额外参数将在 Cargo 配置的任何参数之后被包含在 `args` 字段中。

### 读取请求 * 发送者：Cargo * 目的：获取用于读取 crate 信息的凭证
```javascript
{
    // Protocol version
    "v":1,
    // Request kind: get credentials
    "kind":"get",
    // Action to perform: read crate information
    "operation":"read",
    // Registry information (see Registry information)
    "registry":{"index-url":"sparse+https://registry-url/index/", "name": "my-registry"},
    // Additional command-line args (optional)
    "args":[]
}
```

### 发布请求 * 发送者：Cargo * 目的：获取用于发布 crate 的凭证
```javascript
{
    // Protocol version
    "v":1,
    // Request kind: get credentials
    "kind":"get",
    // Action to perform: publish crate
    "operation":"publish",
    // Crate name
    "name":"sample",
    // Crate version
    "vers":"0.1.0",
    // Crate checksum
    "cksum":"...",
    // Registry information (see Registry information)
    "registry":{"index-url":"sparse+https://registry-url/index/", "name": "my-registry"},
    // Additional command-line args (optional)
    "args":[]
}
```

### 成功响应 * 发送者：凭证提供器 * 目的：将凭证提供给 Cargo
```javascript
{"Ok":{
    // Response kind: this was a get request
    "kind":"get",
    // Token to send to the registry
    "token":"...",
    // Cache control. Can be one of the following:
    // * "never": do not cache
    // * "session": cache for the current cargo session
    // * "expires": cache for the current cargo session until expiration
    "cache":"expires",
    // Unix timestamp (only for "cache": "expires")
    "expiration":1693942857,
    // Is the token operation independent?
    "operation_independent":true
}}
```

`token` 将作为 `Authorization` HTTP 标头的值被发送到注册表。

`operation_independent` 表示该令牌是否可以在不同操作之间缓存（例如发布或获取）。通常应为 `true`，除非提供程序希望生成仅适用于特定操作的令牌。

### 登录成功响应 * 发送者：凭证提供者 * 目的：表明登录成功
```javascript
{"Ok":{
    // Response kind: this was a login request
    "kind":"login"
}}
```

### 登出成功响应 * 发送者：凭证提供者 * 目的：表明登出成功
```javascript
{"Ok":{
    // Response kind: this was a logout request
    "kind":"logout"
}}
```

### 失败响应（URL 不支持） * 发送者：凭证提供者 * 目的：向 Cargo 提供错误信息
```javascript
{"Err":{
    "kind":"url-not-supported"
}}
```
当凭证提供者仅设计用于处理特定注册表 URL，而给定 URL 不受支持时，将发送此响应。如果有其他提供程序可用，Cargo 会尝试使用它。

### 失败响应（未找到） * 发送者：凭证提供者 * 目的：向 Cargo 提供错误信息
```javascript
{"Err":{
    // Error: The credential could not be found in the provider.
    "kind":"not-found"
}}
```
当无法找到凭证时，将发送此响应。这种情况适用于没有可用凭证的 `get` 请求，或没有可清除内容的 `logout` 请求。

### 失败响应（操作不支持） * 发送者：凭证提供者 * 目的：向 Cargo 提供错误信息
```javascript
{"Err":{
    // Error: The credential could not be found in the provider.
    "kind":"operation-not-supported"
}}
```
当凭证提供者不支持所请求的操作时，将发送此响应。如果提供程序仅支持 `get`，而请求了 `login`，则提供程序应返回此错误。

### 失败响应（其他） * 发送者：凭证提供者 * 目的：向 Cargo 提供错误信息
```javascript
{"Err":{
    // Error: something else has failed
    "kind":"other",
    // Error message string to be displayed
    "message": "free form string error message",
    // Detailed cause chain for the error (optional)
    "caused-by": ["cause 1", "cause 2"]
}}
```

## 请求读取令牌的通信示例： 1. Cargo 启动凭证处理过程，捕获标准输入和标准输出。 2. 凭证处理过程向 Cargo 发送 Hello 消息。 3. Cargo 向凭证处理过程发送 CredentialRequest 消息（添加换行符以提高可读性）。 4. 凭证处理过程向 Cargo 发送 CredentialResponse 消息（添加换行符以提高可读性）。 5. Cargo 关闭标准输入管道，使凭证提供者退出。 6. Cargo 在与该注册表交互的剩余会话期间使用令牌（直到 Cargo 退出）。
    ```javascript
    { "v": [1] }
   ```
3. Cargo 向凭证处理程序发送 CredentialRequest 消息（为便于阅读添加了换行符）。
    ```javascript
    {
        "v": 1,
        "kind": "get",
        "operation": "read",
        "registry":{"index-url":"sparse+https://registry-url/index/"}
    }
    ```
4. Credential 处理将 CredentialResponse 发送给 Cargo（为便于阅读添加了换行符）。
    ```javascript
    {
        "token": "...",
        "cache": "session",
        "operation_independent": true
    }
    ```
5. Cargo 关闭了通往凭证提供器的标准输入管道并退出。
6. Cargo 在与此注册表交互时，会在会话的剩余时间（直到 Cargo 退出）使用该令牌。
