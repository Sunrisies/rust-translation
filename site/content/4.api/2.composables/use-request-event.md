---
title: useRequestEvent
description: 使用组合式函数 useRequestEvent 来访问传入的请求事件。
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/ssr.ts
    size: xs
---

在 [Nuxt 上下文](/docs/guide/going-further/nuxt-app#the-nuxt-context)中，你可以使用 `useRequestEvent` 来访问传入的请求。

```ts
// Get underlying request event
const event = useRequestEvent()

// Get the path of the incoming request
const path = event?.path

// Read a request header
const userAgent = event?.headers.get('user-agent')
```

::tip
在浏览器中，`useRequestEvent` 将返回 `undefined`。
::

## 类型

```ts
function useRequestEvent (nuxtApp?: NuxtApp): NuxtRequestEvent | undefined
```

`NuxtRequestEvent` 是你的配置 [服务器构建器](/docs/guide/going-further/builders)所提供的事件格式。使用默认 `@nuxt/nitro-server` 时，即为 h3 v1 的 `H3Event`，因此上述示例中读取的是 `event.path` 而不是 `event.url`。

当没有服务器构建器提供事件类型时，事件将解析为 `RequestEvent`，即每个服务器运行时提供的 Web 标准部分。

| 属性      | 类型                                                          | 描述                                                                       |
| --------- | ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `req`     | `Request`                                                     | 传入的请求，包括其 `headers`、`method` 和 body。                           |
| `url`     | `URL`                                                         | 解析后的请求 URL。                                                         |
| `res`     | `{ status?, statusText?, headers }`                           | 要发送的响应状态和头信息。                                               |
| `context` | `RequestEventContext`                                         | 每个请求的状态，包括 Nuxt 自身的状态，位于 `context.nuxt` 下。         |

任何配置好的服务器构建器下的代码（例如模块的服务器处理程序）应仅读取这些属性。

::read-more{to="/docs/guide/going-further/server-imports"}
更多关于使用 `nuxt/server` 编写可移植的服务器代码的信息，请参考相关文档。
::
